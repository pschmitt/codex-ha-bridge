{
  config,
  inputs,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.codex-ha-bridge;
  defaultPackage = inputs.codex-ha-bridge.packages.${pkgs.stdenv.hostPlatform.system}.default;
in
{
  options.services.codex-ha-bridge = {
    enable = lib.mkEnableOption "the Codex Home Assistant MQTT bridge";

    package = lib.mkOption {
      type = lib.types.package;
      default = defaultPackage;
      defaultText = lib.literalExpression "inputs.codex-ha-bridge.packages.<system>.default";
      description = "Package used to run the Codex Home Assistant MQTT bridge.";
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      description = ''
        Optional file containing environment variables for the bridge, in
        systemd EnvironmentFile format. Use this for secrets such as
        MQTT_PASSWORD or CODEX_ACCESS_TOKEN.
      '';
    };

    environment = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = { };
      description = ''
        Environment variables to pass to the bridge directly. These values
        are written to the generated systemd unit, so do not use this for
        secrets. Values override variables with the same name from
        environmentFile.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.user.services.codex-ha-bridge = {
      Unit = {
        Description = "Codex Home Assistant MQTT bridge";
        After = [ "network.target" ];
      };
      Service = {
        ExecStart = "${cfg.package}/bin/codex-ha-bridge";
        Environment = lib.mapAttrsToList (name: value: "${name}=${value}") (
          { CODEX_HOME = "%h/.config/codex"; } // cfg.environment
        );
        EnvironmentFile = lib.mkIf (cfg.environmentFile != null) [ cfg.environmentFile ];
        Restart = "always";
        RestartSec = "30s";
      };
      Install = {
        WantedBy = [ "default.target" ];
      };
    };
  };
}
