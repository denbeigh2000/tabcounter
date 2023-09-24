{
  description = "Display your tab count in Discord";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    systems.url = "github:nix-systems/default";
    flake-utils = {
      url = "github:numtide/flake-utils";
      inputs.systems.follows = "systems";
    };
    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, systems, fenix }:
    let
      allSystems = import systems;
    in

    flake-utils.lib.eachSystem allSystems (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ fenix.overlays.default ];
        };

        inherit (pkgs.stdenvNoCC.hostPlatform) isDarwin isLinux;

        browseragent = pkgs.callPackage ./browseragent { };

        darwinPkgs = if isDarwin then [ pkgs.libiconv pkgs.darwin.Security ] else [ ];
        linuxPkgs = if isLinux then [ ] else [ ];  # TODO
      in
      {
        packages = rec {
          agent = browseragent.builtDirectory;
          default = agent;
        };

        devShells = rec {
          default = dev;
          dev = pkgs.mkShell {
            packages = with pkgs; [
              websocat
              nodejs_20
              nodePackages.yarn
              nodePackages.typescript
              nodePackages.rollup

              (pkgs.fenix.complete.withComponents
                [
                  "cargo"
                  "clippy"
                  "rustfmt"
                  "rustc"
                  "rust-src"
                ])
              rust-analyzer-nightly

            ] ++ darwinPkgs ++ linuxPkgs;
          };
        };
      });
}
