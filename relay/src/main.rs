use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4};
use std::process;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use clap::Parser;
use discord_sdk::activity::{Activity, ActivityArgs, ActivityBuilder, ActivityKind};
use discord_sdk::{Discord, DiscordHandler, DiscordMsg, Event, Subscriptions};
use serde::Deserialize;
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::net::TcpSocket;
use tokio_stream::StreamExt;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

// use discord_sdk::

#[derive(thiserror::Error, Debug)]
enum MainError {
    #[error("{0}")]
    ParsingCliParams(#[from] clap::Error),
}

#[derive(clap::Parser)]
pub struct CliParams {
    #[clap(env = "TAB_COUNTER_RELAY_APP_ID")]
    app_id: i64,

    // #[clap(env = "TAB_COUNTER_RELAY_APP_SECRET")]
    // app_secret: String,

    // #[clap(env = "TAB_COUNTER_RELAY_PERSONAL_SECRET")]
    // personal_secret: Option<String>,
    #[clap(
        short,
        long,
        env = "TAB_COUNTER_RELAY_SERVING_PORT",
        default_value = "7212"
    )]
    port: u16,
}

#[derive(Clone, Default)]
pub struct State {
    last_seen: Arc<AtomicU32>,
    connected: Arc<AtomicBool>,
}

struct Client {
    pub discord: Discord,
    pub user: discord_sdk::user::User,
    pub wheel: discord_sdk::wheel::Wheel,
}

// NOTE: Should we just not use this? How does this fit in with the wheel
// stuff?
// #[async_trait]
// impl DiscordHandler for State {
//     async fn on_message(&self, msg: DiscordMsg) {
//         match msg {
//             DiscordMsg::Event(e) => match e {
//                 // TODO: If last_seen > 0, set connected activity
//                 Event::Ready(e) => self.connected.store(true, Ordering::Relaxed),
//                 Event::Error(e) => {
//                     eprintln!("Error from Discord RPC: {e:?}");
//                 }
//                 Event::Disconnected { reason } => {
//                     // TODO
//                     eprintln!("disconnected, reason: {reason}");
//                     self.connected.store(false, Ordering::Relaxed)
//                 }
//                 _ => (),
//             },
//             DiscordMsg::Error(e) => {
//                 eprintln!("Error receiving message: {e}");
//                 self.connected.store(false, Ordering::Relaxed)
//             }
//         }
//     }
// }

async fn make_discord_client(params: &CliParams) -> Client {
    let mut subs = Subscriptions::empty();
    subs.insert(Subscriptions::ACTIVITY);

    let (wheel, handler) = discord_sdk::wheel::Wheel::new(Box::new(|e| eprintln!("ERROR: {e}")));

    eprintln!("made wheel");

    let discord = Discord::new(
        discord_sdk::DiscordApp::PlainId(params.app_id),
        subs,
        Box::new(handler),
    )
    .expect("unable to create discord client");
    let mut user = wheel.user();

    let uid = &user.0;

    eprintln!("made initial user: {uid:?}");

    user.0.changed().await.unwrap();

    eprintln!("changed user");

    let user = match &*user.0.borrow() {
        discord_sdk::wheel::UserState::Connected(user) => user.clone(),
        discord_sdk::wheel::UserState::Disconnected(err) => {
            panic!("failed to connect to Discord: {}", err)
        }
    };

    eprintln!("got new user");

    let client = Client {
        discord,
        wheel,
        user,
    };

    client
}

async fn handle_connection(handler: State, client: Arc<Client>, socket: tokio::net::TcpStream) {
    if let Err(e) = try_handle_connection(handler, client, socket).await {
        eprintln!("error handling connection: {e}");
    }
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AgentMessage {
    #[serde(alias = "set_tab_count")]
    SetTabCount { count: u32 },
}

async fn try_handle_connection(
    handler: State,
    client: Arc<Client>,
    socket: tokio::net::TcpStream,
) -> Result<(), std::convert::Infallible> {
    let mut ws = tokio_tungstenite::accept_async(socket).await.unwrap();
    while let Some(message) = ws.next().await {
        let message: AgentMessage = match message {
            Ok(Message::Text(msg)) => serde_json::from_str(&msg).unwrap(),
            Ok(Message::Binary(msg)) => serde_json::from_slice(&msg).unwrap(),
            Err(e) => {
                eprintln!("Error from websocket: {e}");
                eprintln!("closing");

                panic!("{e}");
            }
            _ => todo!(),
        };

        match message {
            AgentMessage::SetTabCount { count } => {
                eprintln!("received new count of {count}");
                handler.last_seen.store(count, Ordering::Relaxed);
                eprintln!("stored new count");
                let activity = Activity {
                    state: Some(format!("{count} tabs open")),
                    kind: ActivityKind::Custom,
                    ..Default::default()
                };

                let mut args = ActivityArgs::default();
                args.activity = Some(activity);
                eprintln!("sending update...");
                client.discord.update_activity(args).await.unwrap();
                eprintln!("activity updated");
            }
        }
    }

    eprintln!("connection closed!");
    Ok(())
}

async fn real_main() -> Result<(), MainError> {
    tracing_subscriber::fmt()
        .compact()
        .with_max_level(tracing::Level::TRACE)
        .init();
    // tracing_log::env_logger::init();

    let args = CliParams::try_parse()?;

    let handler = State::default();

    let ip_addr: Ipv4Addr = "127.0.0.1".parse().unwrap();
    let sock_addr = SocketAddr::V4(SocketAddrV4::new(ip_addr, args.port));
    let socket = TcpSocket::new_v4().unwrap();
    socket.bind(sock_addr).unwrap();
    let listener = socket.listen(3).unwrap();
    eprintln!("made listener");
    let client = Arc::new(make_discord_client(&args).await);
    eprintln!("made client");

    loop {
        eprintln!("waiting for connections");
        let (conn, _) = listener.accept().await.unwrap();
        let client = Arc::clone(&client);
        let handler = handler.clone();
        tokio::spawn(async move {
            handle_connection(handler, client, conn).await;
        });
    }
}

#[tokio::main]
async fn main() {
    let code = match real_main().await {
        Ok(_) => 0,
        Err(MainError::ParsingCliParams(e)) => {
            eprintln!("{e}");
            1
        }
        Err(e) => {
            eprintln!("error running program: {e}");
            1
        }
    };

    process::exit(code);
}
