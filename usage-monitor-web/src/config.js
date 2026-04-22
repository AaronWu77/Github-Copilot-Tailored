import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PLATFORM_FAMILY = os.platform() === "win32" ? "windows" : os.platform() === "darwin" ? "mac" : "unix-like";

function getProviderEnvFile(providerId) {
  return PLATFORM_FAMILY === "windows"
    ? `~\\.copilot\\${providerId}.env`
    : `~/.copilot/${providerId}.env`;
}

const DEFAULT_PROVIDER_ENV_FILES = [
  { id: "deepseek", name: "DeepSeek", envFile: getProviderEnvFile("deepseek") },
  { id: "qwen", name: "Qwen", envFile: getProviderEnvFile("qwen") }
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

  if (providerId === "qwen") {
    return {
      workspaceId: "cn-beijing",
      region: "cn-beijing",
      usageApi: {
        preflightUrl: "https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-usage/usage-statistics",
        url: "https://bailian.console.aliyun.com/data/api.json",
        method: "POST",
        responseType: "json",
        bodyType: "form",
        form: {
          action: "ListBillingQuotas",
          product: "bailian",
          params: {
            WorkspaceId: "${workspaceId}"
          },
          sec_token: "${secToken}",
          umid: "${umid}",
          region: "${region}",
          collina: "${collina}"
        },
        headers: {
          Cookie: "${sessionCookie}",
          "User-Agent": "${userAgent}",
          Referer: "https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-usage/usage-statistics",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Source: "bailian"
        }
      },
      balanceApi: {
        preflightUrl: "https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-usage/free-quota",
        url: "https://bailian.console.aliyun.com/data/api.json",
        method: "POST",
        responseType: "json",
        bodyType: "form",
        form: {
          action: "ListBillingQuotas",
          product: "bailian",
          params: {
            WorkspaceId: "${workspaceId}"
          },
          sec_token: "${secToken}",
          umid: "${umid}",
          region: "${region}",
          collina: "${collina}"
        },
        headers: {
          Cookie: "${sessionCookie}",
          "User-Agent": "${userAgent}",
          Referer: "https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-usage/free-quota",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Source: "bailian"
        }
      },
      parser: {
        usage: {
          totalTokensPath: "data.BillingQuotas",
          promptTokensPath: "data.BillingQuotas",
          completionTokensPath: "data.BillingQuotas",
          requestCountPath: "data.BillingQuotas",
          updatedAtPath: "data.EndDate"
        },
        balance: {
          availablePath: "data.IsCDTLocked",
          currencyPath: "data.BillingQuotas.0.QuotaUnit",
          totalBalancePath: "data.BillingQuotas.0.QuotaValue",
          grantedBalancePath: "data.BillingQuotas.0.UsedQuotaValue",
          toppedUpBalancePath: "data.BillingQuotas.0.QuotaValue"
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

function getPlatformLabel() {
  if (PLATFORM_FAMILY === "windows") {
    return "Windows";
  }

  if (PLATFORM_FAMILY === "mac") {
    return "Mac";
  }

  return "Unix-like";
}

function getAlternateHomePath(filePath) {
  if (typeof filePath !== "string") {
    return null;
  }

  if (filePath.startsWith("~/")) {
    return filePath.replace(/^~\//, "~\\");
  }

  if (filePath.startsWith("~\\")) {
    return filePath.replace(/^~\\/, "~/");
  }

  return null;
}

function buildEnvCandidates(filePath) {
  const candidates = [];
  const alternate = getAlternateHomePath(filePath);

  for (const candidate of [filePath, expandHome(filePath), alternate, expandHome(alternate)].filter(Boolean)) {
    if (!candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

function tryReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readEnvFile(filePathOrCandidates) {
  const candidates = Array.isArray(filePathOrCandidates)
    ? filePathOrCandidates.flatMap((candidate) => buildEnvCandidates(candidate))
    : buildEnvCandidates(filePathOrCandidates);

  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) {
      continue;
    }

    const content = fs.readFileSync(candidate, "utf8");
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
      path: candidate,
      values
    };
  }

  return null;
}

function readCookieValue(cookie, name) {
  if (!cookie || !name) {
    return "";
  }

  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
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
          sessionCookie: envValues.COPILOT_QWEN_COOKIE ?? envValues.COPILOT_PROVIDER_COOKIE ?? "",
          userAgent: envValues.COPILOT_PROVIDER_USER_AGENT ?? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          workspaceId: envValues.COPILOT_QWEN_WORKSPACE_ID ?? envValues.COPILOT_PROVIDER_WORKSPACE_ID ?? readCookieValue(envValues.COPILOT_QWEN_COOKIE ?? envValues.COPILOT_PROVIDER_COOKIE ?? "", "currentRegionId") ?? (baseProvider.id === "qwen" ? "cn-beijing" : ""),
          region: envValues.COPILOT_QWEN_REGION ?? envValues.COPILOT_PROVIDER_REGION ?? readCookieValue(envValues.COPILOT_QWEN_COOKIE ?? envValues.COPILOT_PROVIDER_COOKIE ?? "", "currentRegionId") ?? (baseProvider.id === "qwen" ? "cn-beijing" : ""),
          collina: envValues.COPILOT_QWEN_COLLINA ?? envValues.COPILOT_PROVIDER_COLLINA ?? "",
          usageApi: defaultConfig.usageApi,
          balanceApi: defaultConfig.balanceApi,
          parser: {
            usage: defaultConfig.parser.usage,
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
    platformFamily: PLATFORM_FAMILY,
    platformLabel: getPlatformLabel(),
    providers: mergedProviders
  };
}

export function sanitizeProvider(provider) {
  const { apiKey, usageApi, balanceApi, ...rest } = provider;

  return {
    ...rest,
    usageApi: {
      configured: Boolean(usageApi?.url),
      method: usageApi?.method ?? "GET",
      responseType: usageApi?.responseType ?? "json",
      authConfigured: Boolean(provider.sessionCookie)
    },
    balanceApi: {
      configured: Boolean(balanceApi?.url),
      method: balanceApi?.method ?? "GET",
      responseType: balanceApi?.responseType ?? "json",
      authConfigured: Boolean(provider.sessionCookie)
    }
  };
}
