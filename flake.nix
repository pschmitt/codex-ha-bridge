{
  description = "Publish OpenAI Codex usage limits to Home Assistant over MQTT";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      forEachSystem = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forEachSystem (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.stdenv.mkDerivation {
            pname = "codex-ha-bridge";
            version = "0.1.0";
            src = ./.;

            nativeBuildInputs = [ pkgs.makeWrapper ];

            installPhase = ''
              runHook preInstall
              mkdir -p $out/lib/codex-ha-bridge
              cp -r src package.json $out/lib/codex-ha-bridge/
              makeWrapper ${pkgs.nodejs}/bin/node $out/bin/codex-ha-bridge \
                --add-flags "$out/lib/codex-ha-bridge/src/index.js"
              runHook postInstall
            '';

            meta = {
              description = "Publish OpenAI Codex usage limits to Home Assistant over MQTT";
              homepage = "https://github.com/pschmitt/codex-ha-bridge";
              license = pkgs.lib.licenses.mit;
              mainProgram = "codex-ha-bridge";
            };
          };
        }
      );

      homeManagerModules.default = import ./nix/home-manager.nix;
    };
}
