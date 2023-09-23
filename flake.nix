{
  description = "Display your tab count in Discord";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    systems.url = "github:nix-systems/default";
    flake-utils = {
      url = "github:numtide/flake-utils";
      inputs.systems.follows = "systems";
    };
  };

  outputs = { self, nixpkgs, flake-utils, systems }:
    let
      allSystems = import systems;
    in

    flake-utils.lib.eachSystem allSystems (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        browseragent = pkgs.callPackage ./browseragent { };
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
            ];
          };
        };
      });
}
