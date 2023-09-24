{ writeTextFile, runCommand, yarn2nix-moretea }:

let
  deps = yarn2nix-moretea.mkYarnModules {
    pname = "browseragent-deps";
    version = "0.0.0";
    packageJSON = ./package.json;
    yarnLock = ./yarn.lock;
  };

  tsConfig =
    let
      config = builtins.fromJSON (builtins.readFile ./tsconfig.json);
      patchedConfig = config // {
        typeRoots = [ "${deps}/node_modules/@types" ];
      };

    in
    writeTextFile {
      name = "tsconfig.json";
      text = builtins.toJSON (patchedConfig);
    };
in

rec {
  compiledJs = runCommand "browseragent-background.js" { } ''
    ln -s ${deps}/node_modules ./node_modules
    ln -s ${tsConfig} tsconfig.json
    ln -s ${./src} ./src

    ls -l

    NODE_PATH="${deps}/node_modules" ./node_modules/.bin/rollup \
    --config ${./rollup.config.mjs} \
    --bundleConfigAsCjs \
    --file $out \
    ./src/background.ts
  '';

  builtDirectory = runCommand "browseragent" { } ''
    mkdir $out
    cp ${./src/manifest.json} $out/manifest.json
    cp ${compiledJs} $out/background.js
  '';
}
