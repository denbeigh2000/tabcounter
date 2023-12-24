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

{
  builtDirectory = runCommand "browseragent" { } ''
    cp -r ${deps}/node_modules ./node_modules
    cp -r ${./package.json} ./package.json
    cp -r ${./src} ./src
    cp -r ${./vite.config.ts} ./vite.config.ts
    cp -r ${./tsconfig.json} ./tsconfig.json

    ls -l src/manifest.ts

    ./node_modules/.bin/tsc -p ./tsconfig.json
    ./node_modules/.bin/vite build
    mv ./dist $out
  '';
}
