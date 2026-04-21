function getValueByPath(input, dottedPath) {
  if (!input || !dottedPath) {
    return null;
  }

  return dottedPath
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => {
      if (current === null || current === undefined) {
        return null;
      }

      return current[key];
    }, input);
}

function applyTemplate(value, context) {
  if (typeof value !== "string") {
    return value;
  }

  return value.replace(/\$\{(\w+)\}/g, (_, key) => context[key] ?? "");
}

function buildHeaders(headers, context) {
  const normalized = {};

  for (const [key, value] of Object.entries(headers ?? {})) {
    normalized[key] = applyTemplate(value, context);
  }

  return normalized;
}

async function fetchJson(apiConfig, context) {
  if (!apiConfig?.url) {
    return {
      state: "skipped",
      reason: "未配置接口地址"
    };
  }

  const response = await fetch(applyTemplate(apiConfig.url, context), {
    method: apiConfig.method ?? "GET",
    headers: buildHeaders(apiConfig.headers, context)
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    return {
      state: "error",
      statusCode: response.status,
      reason: typeof payload === "string" ? payload : JSON.stringify(payload)
    };
  }

  if (typeof payload === "string") {
    return {
      state: "error",
      reason: "接口未返回 JSON，当前原型只支持 JSON 响应"
    };
  }

  return {
    state: "ok",
    payload
  };
}

function parseUsage(payload, parser) {
  return {
    totalTokens: getValueByPath(payload, parser?.totalTokensPath),
    promptTokens: getValueByPath(payload, parser?.promptTokensPath),
    completionTokens: getValueByPath(payload, parser?.completionTokensPath),
    requestCount: getValueByPath(payload, parser?.requestCountPath),
    updatedAt: getValueByPath(payload, parser?.updatedAtPath)
  };
}

function parseBalance(payload, parser) {
  const balanceInfos = Array.isArray(payload?.balance_infos)
    ? payload.balance_infos.map((item) => ({
        currency: item?.currency ?? null,
        totalBalance: item?.total_balance ?? null,
        grantedBalance: item?.granted_balance ?? null,
        toppedUpBalance: item?.topped_up_balance ?? null
      }))
    : [];

  return {
    available: getValueByPath(payload, parser?.availablePath),
    remaining: getValueByPath(payload, parser?.remainingPath),
    limit: getValueByPath(payload, parser?.limitPath),
    spent: getValueByPath(payload, parser?.spentPath),
    currency: getValueByPath(payload, parser?.currencyPath),
    totalBalance: getValueByPath(payload, parser?.totalBalancePath),
    grantedBalance: getValueByPath(payload, parser?.grantedBalancePath),
    toppedUpBalance: getValueByPath(payload, parser?.toppedUpBalancePath),
    balanceInfos,
    balanceInfoCount: balanceInfos.length,
    updatedAt: getValueByPath(payload, parser?.updatedAtPath)
  };
}

export async function collectProviderSnapshot(provider) {
  if (provider.enabled === false) {
    return {
      id: provider.id,
      name: provider.name,
      disabled: true,
      status: "disabled",
      message: "已禁用"
    };
  }

  const context = {
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: provider.model,
    providerId: provider.id
  };

  const warnings = [];

  if (!provider.envDetected) {
    warnings.push("未找到 provider env 文件");
  }

  if (!provider.apiKey) {
    warnings.push("未从 env 中读取到 API Key");
  }

  const [usageResult, balanceResult] = await Promise.all([
    fetchJson(provider.usageApi, context).catch((error) => ({
      state: "error",
      reason: error.message
    })),
    fetchJson(provider.balanceApi, context).catch((error) => ({
      state: "error",
      reason: error.message
    }))
  ]);

  let status = "ready";

  if (usageResult.state === "skipped" && balanceResult.state === "skipped") {
    status = "needs_configuration";
  } else if (usageResult.state === "error" || balanceResult.state === "error") {
    status = "partial";
  } else if (balanceResult.state === "ok" || usageResult.state === "ok") {
    status = "ready";
  }

  return {
    id: provider.id,
    name: provider.name,
    model: provider.model,
    baseUrl: provider.baseUrl,
    envFile: provider.envFile,
    envDetected: provider.envDetected,
    status,
    checkedAt: new Date().toISOString(),
    warnings,
    usage: {
      state: usageResult.state,
      error: usageResult.reason ?? null,
      metrics: usageResult.state === "ok" ? parseUsage(usageResult.payload, provider.parser?.usage) : null
    },
    balance: {
      state: balanceResult.state,
      error: balanceResult.reason ?? null,
      metrics: balanceResult.state === "ok" ? parseBalance(balanceResult.payload, provider.parser?.balance) : null
    }
  };
}

export async function collectAllProvidersSnapshot(config) {
  const providers = await Promise.all(config.providers.map((provider) => collectProviderSnapshot(provider)));

  return {
    generatedAt: new Date().toISOString(),
    pollingIntervalMs: config.pollingIntervalMs,
    configPath: config.configPath,
    candidatePaths: config.candidatePaths,
    providers
  };
}
