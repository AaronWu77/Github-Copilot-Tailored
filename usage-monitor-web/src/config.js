import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_PROVIDER_ENV_FILES = [
  { id: "deepseek", name: "DeepSeek", envFile: "~/.copilot/deepseek.env" },
  { id: "qwen", name: "Qwen", envFile: "~/.copilot/qwen.env" }
];

function getDefaultProviderConfig(providerId) {
  if (providerId === "deepseek") {
    return {
      balanceApi: {
        url: "${baseUrl}/user/balance",
        method: "GET",
        headers: {
          Authorization: "Bearer ${apiKey}"
        }
      },
      parser: {
        balance: {
          availablePath: "is_available",
          currencyPath: "balance_infos.0.currency",
          totalBalancePath: "balance_infos.0.total_balance",
          grantedBalancePath: "balance_infos.0.granted_balance",
          toppedUpBalancePath: "balance_infos.0.topped_up_balance"
        }
      }
    };
  }

  return {
    balanceApi: {},
    parser: {
      balance: {}
    }
  };
}

export function expandHome(filePath) {
  if (!filePath) {
    return filePath;
  }

  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }

  if (filePath.startsWith("~\\")) {
    return path.join(os.homedir(), filePath.slice(2));
  }

  return filePath;
}

function tryReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readEnvFile(filePath) {
  const absolutePath = expandHome(filePath);

  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return null;
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1].trim();
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return {
    path: absolutePath,
    values
  };
}

function uniqueById(items) {
  const map = new Map();

  for (const item of items) {
    if (!item?.id) {
      continue;
    }

    map.set(item.id, item);
  }

  return [...map.values()];
}

function buildBaseProviders(configProviders) {
  const providers = [...DEFAULT_PROVIDER_ENV_FILES.map((provider) => ({ ...provider }))];

  for (const configProvider of configProviders) {
    if (!providers.some((provider) => provider.id === configProvider.id)) {
      providers.push({
        id: configProvider.id,
        name: configProvider.name ?? configProvider.id,
        envFile: configProvider.envFile
      });
    }
  }

  return uniqueById(providers);
}

function mergeProvider(baseProvider, configProvider) {
  if (!configProvider) {
    return baseProvider;
  }

  return {
    ...baseProvider,
    ...configProvider,
    usageApi: {
      ...(baseProvider.usageApi ?? {}),
      ...(configProvider.usageApi ?? {})
    },
    balanceApi: {
      ...(baseProvider.balanceApi ?? {}),
      ...(configProvider.balanceApi ?? {})
    },
    parser: {
      ...(baseProvider.parser ?? {}),
      ...(configProvider.parser ?? {}),
      usage: {
        ...(baseProvider.parser?.usage ?? {}),
        ...(configProvider.parser?.usage ?? {})
      },
      balance: {
        ...(baseProvider.parser?.balance ?? {}),
        ...(configProvider.parser?.balance ?? {})
      }
    }
  };
}

export function loadMonitorConfig(projectRoot) {
  const candidatePaths = [
    process.env.USAGE_MONITOR_CONFIG,
    path.join(projectRoot, "config", "providers.local.json"),
    path.join(os.homedir(), ".copilot", "usage-monitor.providers.json")
  ].filter(Boolean);

  const configPath = candidatePaths.find((candidate) => fs.existsSync(candidate));
  const userConfig = configPath ? tryReadJson(configPath) ?? {} : {};
  const configProviders = Array.isArray(userConfig.providers) ? userConfig.providers : [];

  const mergedProviders = [];
  const baseProviders = buildBaseProviders(configProviders);

  for (const baseProvider of baseProviders) {
    const configProvider = configProviders.find((provider) => provider.id === baseProvider.id);
    const envSource = readEnvFile(configProvider?.envFile ?? baseProvider.envFile);
    const envValues = envSource?.values ?? {};
    const defaultConfig = getDefaultProviderConfig(baseProvider.id);

    mergedProviders.push(
      mergeProvider(
        {
          id: baseProvider.id,
          name: baseProvider.name,
          enabled: true,
          envFile: envSource?.path ?? expandHome(configProvider?.envFile ?? baseProvider.envFile),
          envDetected: Boolean(envSource),
          baseUrl: envValues.COPILOT_PROVIDER_BASE_URL ?? "",
          apiKey: envValues.COPILOT_PROVIDER_API_KEY ?? "",
          model: envValues.COPILOT_MODEL ?? "",
          usageApi: {},
          balanceApi: defaultConfig.balanceApi,
          parser: {
            usage: {},
            balance: defaultConfig.parser.balance
          }
        },
        configProvider
      )
    );
  }

  return {
    pollingIntervalMs: Math.max(5000, Number(userConfig.pollingIntervalMs) || 60000),
    configPath,
    candidatePaths,
    providers: mergedProviders
  };
}

export function sanitizeProvider(provider) {
  const { apiKey, usageApi, balanceApi, ...rest } = provider;

  return {
    ...rest,
    usageApi: {
      configured: Boolean(usageApi?.url),
      method: usageApi?.method ?? "GET"
    },
    balanceApi: {
      configured: Boolean(balanceApi?.url),
      method: balanceApi?.method ?? "GET"
    }
  };
}
