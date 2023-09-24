{ toolchain, naersk }:

naersk.buildPackage {
  src = ./.;
}
