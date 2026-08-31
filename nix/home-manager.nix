{
  config,
  inputs,
  pkgs,
  ...
}:
{
  sops.secrets."codex-ha-bridge/env".mode = "0600";

  systemd.user.services.codex-ha-bridge = {
    Unit = {
      Description = "Codex HA Bridge";
      After = [
        "network.target"
        "sops-nix.service"
      ];
    };
    Service = {
      ExecStart = "${
        inputs.codex-ha-bridge.packages.${pkgs.stdenv.hostPlatform.system}.default
      }/bin/codex-ha-bridge";
      Environment = [ "CODEX_HOME=%h/.config/codex" ];
      EnvironmentFile = config.sops.secrets."codex-ha-bridge/env".path;
      Restart = "always";
      RestartSec = "30s";
    };
    Install = {
      WantedBy = [ "default.target" ];
    };
  };
}
