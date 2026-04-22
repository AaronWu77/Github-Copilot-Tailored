import { chromium } from "playwright";

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
    const rendered = applyTemplate(value, context);
    if (rendered === "" || rendered === null || rendered === undefined) {
      continue;
    }

    normalized[key] = rendered;
  }

  return normalized;
}

function buildBody(body, context) {
  if (body === null || body === undefined) {
    return null;
  }

  if (typeof body === "string") {
    return applyTemplate(body, context);
  }

  if (Array.isArray(body)) {
    return body.map((item) => buildBody(item, context));
  }

  if (typeof body === "object") {
    const normalized = {};

    for (const [key, value] of Object.entries(body)) {
      const rendered = buildBody(value, context);
      if (rendered === undefined) {
        continue;
      }

      normalized[key] = rendered;
    }

    return normalized;
  }

  return body;
}

function buildFormBody(form, context) {
  if (form === null || form === undefined) {
    return null;
  }

  if (typeof form === "string") {
    return applyTemplate(form, context);
  }

  const entries = [];
  const pushEntry = (key, value) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

    if (typeof value === "object") {
      entries.push([key, JSON.stringify(buildBody(value, context))]);
      return;
    }

    entries.push([key, String(applyTemplate(value, context))]);
  };

  for (const [key, value] of Object.entries(form)) {
    pushEntry(key, buildBody(value, context));
  }

  return new URLSearchParams(entries).toString();
}

function stripHtml(input) {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function safeStringify(value) {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return "";
  }
}

function compilePattern(pattern) {
  if (!pattern) {
    return null;
  }

  if (pattern instanceof RegExp) {
    return pattern;
  }

  return new RegExp(pattern, "i");
}

function extractPatternValue(text, pattern, groupIndex = 1) {
  if (typeof text !== "string") {
    return null;
  }

  const compiled = compilePattern(pattern);
  if (!compiled) {
    return null;
  }

  const match = text.match(compiled);
  if (!match) {
    return null;
  }

  return match[groupIndex] ?? match[0] ?? null;
}

function extractQuotaPair(text, pattern) {
  const compiled = compilePattern(pattern);
  if (!compiled || typeof text !== "string") {
    return {};
  }

  const match = text.match(compiled);
  if (!match) {
    return {};
  }

  return {
    remaining: match[1] ?? null,
    limit: match[2] ?? null
  };
}

function resolveUrl(candidateUrl, baseUrl) {
  try {
    return new URL(candidateUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

function remapDeepseekStaticApiHost(candidateUrl, pageUrl) {
  try {
    const resolved = new URL(candidateUrl);
    const page = new URL(pageUrl);
    if (
      resolved.hostname === "fe-static.deepseek.com" &&
      resolved.pathname.startsWith("/api/")
    ) {
      return `${page.protocol}//${page.host}${resolved.pathname}${resolved.search}${resolved.hash}`;
    }

    return candidateUrl;
  } catch {
    return candidateUrl;
  }
}

function isLikelyCandidateUrl(candidateUrl) {
  if (!candidateUrl || typeof candidateUrl !== "string") {
    return false;
  }

  if (/^(data:|javascript:|mailto:|blob:)/i.test(candidateUrl)) {
    return false;
  }

  if (/\.(?:css|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|ico)(?:$|\?)/i.test(candidateUrl)) {
    return false;
  }

  try {
    const url = new URL(candidateUrl);
    const allowedHost = /(?:^|\.)?(?:platform\.deepseek\.com|deepseek\.com|bailian\.console\.aliyun\.com|modelstudio\.console\.alibabacloud\.com|billing-cost\.console\.aliyun\.com|usercenter2\.aliyun\.com|m\.api\.aliyun-inc\.com|api\.aliyun\.com|dashscope\.aliyuncs\.com|aliyun\.com|alicdn\.com|g\.alicdn\.com)$/i.test(url.hostname);

    if (!allowedHost) {
      return false;
    }

    if (/\/model-market\/detail\//i.test(url.pathname + url.hash)) {
      return false;
    }

    return /(?:\/api(?:\/|$)|\/graphql(?:\/|$)|\/query(?:\/|$)|\/app-data(?:\/|$)|\/dataset(?:\/|$)|\/data(?:\/|$)|\.json(?:$|\?))/i.test(
      `${url.pathname}${url.search}${url.hash}`
    );
  } catch {
    return /(?:\/api(?:\/|$)|\/graphql(?:\/|$)|\/query(?:\/|$)|\/app-data(?:\/|$)|\/dataset(?:\/|$)|\/data(?:\/|$)|\.json(?:$|\?))/i.test(candidateUrl);
  }
}

function extractCandidateUrlsFromText(text, baseUrl) {
  const candidates = [];
  const patterns = [
    /(?:fetch|axios\.(?:get|post|put|patch|delete|request)|open)\s*\(\s*(["'`])([^"'`]+)\1/gi,
    /(?:url|href|endpoint|apiUrl|requestUrl)\s*[:=]\s*(["'`])([^"'`]+)\1/gi,
    /(["'`])((?:https?:)?\/\/[^"'`]+|\/[^"'`]+)\1/g,
    /((?:https?:)?\/\/[^\s"'`<>]+|\/[A-Za-z0-9._~\-/?#=&%:+]+)(?=[\s"'`<>)]|$)/g
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const rawUrl = match[2] ?? match[1] ?? match[0];
      const resolvedUrl = resolveUrl(rawUrl, baseUrl);
      if (resolvedUrl && isLikelyCandidateUrl(resolvedUrl)) {
        candidates.push(resolvedUrl);
      }
    }
  }

  return [...new Set(candidates)];
}

function extractScriptUrlsFromHtml(html, baseUrl) {
  const scriptUrls = [];
  for (const match of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    const resolvedUrl = resolveUrl(match[1], baseUrl);
    if (resolvedUrl) {
      scriptUrls.push(resolvedUrl);
    }
  }

  return [...new Set(scriptUrls)];
}

function shouldScanScript(scriptUrl, pageUrl) {
  try {
    const scriptHost = new URL(scriptUrl).hostname;
    const pageHost = new URL(pageUrl).hostname;
    return (
      scriptHost === pageHost ||
      scriptHost.endsWith(".deepseek.com") ||
      scriptHost.endsWith(".aliyun.com") ||
      scriptHost.endsWith(".alicdn.com") ||
      scriptHost.endsWith(".aliyuncs.com")
    );
  } catch {
    return false;
  }
}

async function fetchText(url, headers) {
  const response = await fetch(url, { headers });
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  return { ok: response.ok, status: response.status, contentType, text };
}

function parseCookieHeader(cookieHeader, hostname) {
  if (!cookieHeader || !hostname) {
    return [];
  }

  return cookieHeader
    .split(/;\s*/)
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) {
        return null;
      }

      return {
        name: pair.slice(0, separatorIndex),
        value: pair.slice(separatorIndex + 1),
        domain: hostname,
        path: "/",
        secure: true,
        httpOnly: false
      };
    })
    .filter(Boolean);
}

function isBusyPage(text) {
  return /系统繁忙|请刷新页面重试|请重试|页面繁忙/i.test(text ?? "");
}

function isPermissionPage(text) {
  return /进入当前空间下百炼权限管理页面去授权|添加RAM账号或RAM角色|添加本空间下具体的权限/i.test(text ?? "");
}

async function fetchRenderedPage(pageUrl, context) {
  const browser = await chromium.launch({ headless: true });

  try {
    const pageUrlObject = new URL(pageUrl);
    const pageContext = await browser.newContext({
      userAgent: context.userAgent,
      viewport: { width: 1440, height: 900 }
    });

    const cookies = parseCookieHeader(context.sessionCookie, pageUrlObject.hostname);
    if (cookies.length > 0) {
      await pageContext.addCookies(cookies);
    }

    const page = await pageContext.newPage();
    const consoleState = {
      loginStatus: null,
      spaceInited: null,
      loginInfoError: null,
      initSpaceError: null
    };

    page.on("response", async (response) => {
      const responseUrl = response.url();
      if (!/bailian-cs\.console\.aliyun\.com\/data\/api\.json/i.test(responseUrl)) {
        return;
      }

      if (!/loginInfo|initSpace/i.test(responseUrl)) {
        return;
      }

      const body = await response.text().catch(() => "");
      let parsed = null;
      try {
        parsed = JSON.parse(body);
      } catch {
        return;
      }

      const apiName = responseUrl.includes("loginInfo") ? "loginInfo" : "initSpace";
      const apiData = parsed?.data?.DataV2?.data?.data ?? parsed?.data?.data ?? parsed?.data?.DataV2?.data ?? null;

      if (apiName === "loginInfo") {
        consoleState.loginStatus = apiData?.loginStatus ?? consoleState.loginStatus;
        consoleState.spaceInited = apiData?.spaceInited ?? consoleState.spaceInited;
        consoleState.loginInfoError = parsed?.data?.errorMsg ?? parsed?.data?.errorCode ?? consoleState.loginInfoError;
      } else if (apiName === "initSpace") {
        consoleState.initSpaceError = parsed?.data?.errorMsg ?? parsed?.data?.errorCode ?? consoleState.initSpaceError;
      }
    });

    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(12000);

    const text = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
    const tokenInfo = await page.evaluate(() => ({
      secToken: window.ALIYUN_CONSOLE_CONFIG?.SEC_TOKEN ?? null,
      umid: window.RISK_INFO?.UMID ?? null
    })).catch(() => ({ secToken: null, umid: null }));

    return {
      url: page.url(),
      text,
      secToken: tokenInfo.secToken,
      umid: tokenInfo.umid,
      consoleState
    };
  } finally {
    await browser.close();
  }
}

async function discoverXhrCandidates(pageUrl, html, headers) {
  const candidateUrls = new Set();
  const htmlCandidates = extractCandidateUrlsFromText(html, pageUrl);
  for (const candidate of htmlCandidates) {
    candidateUrls.add(candidate);
  }

  const scriptUrls = extractScriptUrlsFromHtml(html, pageUrl)
    .filter((scriptUrl) => shouldScanScript(scriptUrl, pageUrl));

  for (const scriptUrl of scriptUrls.slice(0, 12)) {
    const scriptResult = await fetchText(scriptUrl, headers);
    if (!scriptResult.ok || !scriptResult.text) {
      continue;
    }

    for (const candidate of extractCandidateUrlsFromText(scriptResult.text, scriptUrl)) {
      candidateUrls.add(candidate);
    }
  }

  return [...candidateUrls]
    .map((candidateUrl) => remapDeepseekStaticApiHost(candidateUrl, pageUrl))
    .filter((candidateUrl) => candidateUrl !== pageUrl)
    .map((candidateUrl) => ({
      url: candidateUrl,
      score: /usage|quota|balance|billing|expense|telemetry|monitor|query|json|data|summary|get_usr|amount|cost|wallet|token/i.test(candidateUrl) ? 2 : 1
    }))
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score);
}

function isAuthPage(text) {
  return /登录|请先登录|sign in|signin|验证码|身份验证|安全验证|扫码登录|cookie/i.test(text ?? "");
}

function normalizeResourcePayload(resource) {
  if (!resource) {
    return {
      contentType: "",
      payload: null,
      text: ""
    };
  }

  if (typeof resource.payload === "string") {
    return {
      contentType: resource.contentType ?? "",
      payload: resource.payload,
      text: stripHtml(resource.payload)
    };
  }

  return {
    contentType: resource.contentType ?? "",
    payload: resource.payload,
    text: safeStringify(resource.payload)
  };
}

function extractConsoleTokens(html) {
  if (typeof html !== "string") {
    return {};
  }

  return {
    secToken: extractPatternValue(html, /SEC_TOKEN:\s*"([^"]+)"/i, 1),
    umid: extractPatternValue(html, /RISK_INFO\.UMID\s*=\s*"([^"]+)"/i, 1)
  };
}

async function fetchCandidateResource(candidate, context) {
  const body = candidate.form !== undefined
    ? buildFormBody(candidate.form, context)
    : buildBody(candidate.json ?? candidate.body, context);
  const headers = buildHeaders(candidate.headers, context);
  if (body && typeof body === "object" && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
    headers["Content-Type"] = "application/json";
  }

  const requestInit = {
    method: candidate.method ?? "GET",
    headers
  };

  if (body !== null && body !== undefined) {
    requestInit.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(candidate.url, requestInit);

  const contentType = response.headers.get("content-type") ?? "";
  const responseType = contentType.includes("application/json") ? "json" : "text";
  const payload = responseType === "json"
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    return {
      state: "error",
      statusCode: response.status,
      reason: typeof payload === "string" ? payload : JSON.stringify(payload),
      contentType,
      url: candidate.url
    };
  }

  if (typeof payload === "string") {
    const text = stripHtml(payload);

    if (isAuthPage(text)) {
      return {
        state: "auth_required",
        reason: "接口返回了登录页或验证页，页面抓取需要有效登录态或 Cookie",
        contentType,
        url: candidate.url,
        payload
      };
    }

    return {
      state: "ok",
      payload,
      contentType,
      url: candidate.url,
      text
    };
  }

  return {
    state: "ok",
    payload,
    contentType,
    url: candidate.url,
    text: safeStringify(payload)
  };
}

function buildDeepseekUsageFallbackCandidates(basePageUrl) {
  let origin = "https://platform.deepseek.com";
  try {
    origin = new URL(basePageUrl).origin;
  } catch {
    // keep default origin
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return [
    `${origin}/api/v0/users/get_usr_summary`,
    `${origin}/api/v0/users/get_user_summary`,
    `${origin}/api/v0/usage/amount?month=${month}&year=${year}`,
    `${origin}/api/v0/usage/cost?month=${month}&year=${year}`,
    `${origin}/api/v0/usage/cost.list?month=${month}&year=${year}`
  ];
}

function hasParsedValue(metrics) {
  if (!metrics) {
    return false;
  }

  return Object.values(metrics).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return value !== null && value !== undefined && value !== "";
  });
}

async function fetchResource(apiConfig, context, parser, kind) {
  if (!apiConfig?.url) {
    return {
      state: "skipped",
      reason: "未配置接口地址"
    };
  }

  const resolvedContext = { ...context };

  if (apiConfig.preflightUrl) {
    const preflightUrl = applyTemplate(apiConfig.preflightUrl, resolvedContext);
    if (context.providerId === "qwen") {
      const renderedPage = await fetchRenderedPage(preflightUrl, resolvedContext);
      if (renderedPage.secToken) {
        resolvedContext.secToken = renderedPage.secToken;
      }
      if (renderedPage.umid) {
        resolvedContext.umid = renderedPage.umid;
      }

      if (renderedPage.consoleState?.loginStatus === "NOT_LOGINED" || renderedPage.consoleState?.initSpaceError === "BailianGateway.Login.NotLogined") {
        return {
          state: "auth_required",
          reason: "控制台 RPC 返回未登录",
          url: renderedPage.url,
          text: renderedPage.text
        };
      }

      if (renderedPage.consoleState?.spaceInited === false) {
        return {
          state: "auth_required",
          reason: "控制台空间尚未初始化或未登录",
          url: renderedPage.url,
          text: renderedPage.text
        };
      }

      if (isBusyPage(renderedPage.text)) {
        return {
          state: "busy",
          reason: "页面提示系统繁忙，请刷新页面重试",
          url: renderedPage.url,
          text: renderedPage.text
        };
      }

      if (isPermissionPage(renderedPage.text) || isAuthPage(renderedPage.text)) {
        return {
          state: "auth_required",
          reason: "页面提示需要登录或权限授权",
          url: renderedPage.url,
          text: renderedPage.text
        };
      }
    } else {
      const preflightHeaders = buildHeaders(apiConfig.headers, resolvedContext);
      const preflightResult = await fetchText(preflightUrl, preflightHeaders);
      if (preflightResult.ok && preflightResult.text) {
        Object.assign(resolvedContext, extractConsoleTokens(preflightResult.text));
      }
    }
  }

  const url = applyTemplate(apiConfig.url, resolvedContext);
  const body = apiConfig.bodyType === "form"
    ? buildFormBody(apiConfig.form, resolvedContext)
    : buildBody(apiConfig.json ?? apiConfig.body, resolvedContext);
  const headers = buildHeaders(apiConfig.headers, resolvedContext);
  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
  if (body && typeof body === "object" && !hasContentType) {
    headers["Content-Type"] = "application/json";
  } else if (apiConfig.bodyType === "form" && !hasContentType) {
    headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
  }

  const requestInit = {
    method: apiConfig.method ?? "GET",
    headers
  };

  if (body !== null && body !== undefined) {
    requestInit.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(url, requestInit);

  const contentType = response.headers.get("content-type") ?? "";
  const responseType = apiConfig.responseType ?? (contentType.includes("application/json") ? "json" : "text");
  const payload = responseType === "json" && contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    return {
      state: "error",
      statusCode: response.status,
      reason: typeof payload === "string" ? payload : JSON.stringify(payload),
      contentType,
      url
    };
  }

  if (typeof payload === "string") {
    const text = stripHtml(payload);

    if (isAuthPage(text)) {
      return {
        state: "auth_required",
        reason: "接口返回了登录页或验证页，页面抓取需要有效登录态或 Cookie",
        contentType,
        url,
        payload
      };
    }

    if (responseType !== "html") {
      return {
        state: responseType === "json"
          ? "error"
          : "ok",
        payload,
        contentType,
        url,
        text
      };
    }
  }

  const initialResult = {
    state: "ok",
    payload,
    contentType,
    url,
    text: safeStringify(payload)
  };

  const initialMetrics = kind === "usage"
    ? parseUsage(initialResult, parser)
    : parseBalance(initialResult, parser);

  if (hasParsedValue(initialMetrics)) {
    return {
      ...initialResult,
      metrics: initialMetrics
    };
  }

  if (apiConfig.responseType !== "html") {
    return initialResult;
  }

  const discoverXhr = apiConfig.discoverXhr !== false;
  if (!discoverXhr || typeof payload !== "string") {
    return initialResult;
  }
  const candidates = await discoverXhrCandidates(url, payload, buildHeaders(apiConfig.headers, context));

  let sawAuthRequired = false;

  for (const candidate of candidates.slice(0, apiConfig.maxDiscoveryCandidates ?? 8)) {
    const candidateResult = await fetchCandidateResource({
      ...candidate,
      method: candidate.method ?? apiConfig.discoveryMethod ?? "GET",
      headers: {
        ...(apiConfig.headers ?? {}),
        ...(candidate.headers ?? {})
      }
    }, context).catch((error) => ({
      state: "error",
      reason: error.message
    }));

    if (candidateResult.state === "auth_required") {
      sawAuthRequired = true;
      continue;
    }

    if (candidateResult.state !== "ok") {
      continue;
    }

    const metrics = kind === "usage"
      ? parseUsage(candidateResult, parser)
      : parseBalance(candidateResult, parser);

    if (hasParsedValue(metrics)) {
      return {
        ...candidateResult,
        discoveredFrom: url,
        discoveryCandidates: candidates.map((item) => item.url),
        metrics
      };
    }
  }

  if (context.providerId === "deepseek" && kind === "usage") {
    const fallbackUrls = buildDeepseekUsageFallbackCandidates(url);
    for (const fallbackUrl of fallbackUrls) {
      if (candidates.some((item) => item.url === fallbackUrl)) {
        continue;
      }

      const candidateResult = await fetchCandidateResource({
        url: fallbackUrl,
        method: "GET",
        headers: apiConfig.headers ?? {}
      }, context).catch((error) => ({
        state: "error",
        reason: error.message
      }));

      if (candidateResult.state !== "ok") {
        continue;
      }

      const metrics = parseUsage(candidateResult, parser);
      if (hasParsedValue(metrics)) {
        return {
          ...candidateResult,
          discoveredFrom: url,
          discoveryCandidates: [...candidates.map((item) => item.url), ...fallbackUrls],
          metrics
        };
      }
    }
  }

  if (sawAuthRequired) {
    return {
      ...initialResult,
      state: "auth_required",
      reason: "页面已登录，但自动识别到的 XHR 入口仍需要更完整的登录态或 Cookie",
      discoveryCandidates: candidates.map((item) => item.url)
    };
  }

  return {
    ...initialResult,
    state: "no_xhr_found",
    reason: "已抓取页面，但未自动识别到可用的 XHR 入口",
    discoveryCandidates: candidates.map((item) => item.url)
  };
}

function readJsonOrTextValue(payload, text, path, pattern, groupIndex = 1) {
  const jsonValue = getValueByPath(payload, path);
  if (jsonValue !== null && jsonValue !== undefined && jsonValue !== "") {
    return jsonValue;
  }

  const textValue = extractPatternValue(text, pattern, groupIndex);
  return textValue;
}

function parseUsage(resource, parser) {
  const { payload, text } = normalizeResourcePayload(resource);
  const quotaEntries = extractBillingQuotaEntries(payload);
  const deepseekSummary = payload?.data?.biz_data;

  if (deepseekSummary) {
    return {
      totalTokens: deepseekSummary.total_available_token_estimation ?? deepseekSummary.current_token ?? null,
      promptTokens: deepseekSummary.monthly_token_usage ?? deepseekSummary.monthly_usage ?? null,
      completionTokens: deepseekSummary.total_usage ?? null,
      requestCount: deepseekSummary.current_token ?? null,
      updatedAt: null
    };
  }

  if (quotaEntries.length > 0) {
    const aggregate = aggregateQuotaEntries(quotaEntries);
    return {
      totalTokens: aggregate.limit,
      promptTokens: aggregate.spent,
      completionTokens: aggregate.remaining,
      requestCount: quotaEntries.length,
      updatedAt: payload?.data?.EndDate ?? payload?.EndDate ?? payload?.data?.StartDate ?? payload?.StartDate ?? null
    };
  }

  return {
    totalTokens: readJsonOrTextValue(payload, text, parser?.totalTokensPath, parser?.totalTokensPattern, parser?.totalTokensGroup ?? 1),
    promptTokens: readJsonOrTextValue(payload, text, parser?.promptTokensPath, parser?.promptTokensPattern, parser?.promptTokensGroup ?? 1),
    completionTokens: readJsonOrTextValue(payload, text, parser?.completionTokensPath, parser?.completionTokensPattern, parser?.completionTokensGroup ?? 1),
    requestCount: readJsonOrTextValue(payload, text, parser?.requestCountPath, parser?.requestCountPattern, parser?.requestCountGroup ?? 1),
    updatedAt: readJsonOrTextValue(payload, text, parser?.updatedAtPath, parser?.updatedAtPattern, parser?.updatedAtGroup ?? 1)
  };
}

function parseBalance(resource, parser) {
  const { payload, text } = normalizeResourcePayload(resource);
  const quotaEntries = extractBillingQuotaEntries(payload);
  const balanceInfos = quotaEntries.length > 0
    ? quotaEntries.map((item) => ({
        currency: item.currency,
        totalBalance: item.totalBalance,
        grantedBalance: item.grantedBalance,
        toppedUpBalance: item.toppedUpBalance
      }))
    : Array.isArray(payload?.balance_infos)
      ? payload.balance_infos.map((item) => ({
          currency: item?.currency ?? null,
          totalBalance: item?.total_balance ?? null,
          grantedBalance: item?.granted_balance ?? null,
          toppedUpBalance: item?.topped_up_balance ?? null
        }))
      : [];

  const quotaPair = extractQuotaPair(text, parser?.quotaRatioPattern);
  const aggregate = aggregateQuotaEntries(quotaEntries);
  const hasQuotaData = quotaEntries.length > 0;

  return {
    available: hasQuotaData
      ? !Boolean(payload?.data?.IsCDTLocked ?? payload?.IsCDTLocked)
      : readJsonOrTextValue(payload, text, parser?.availablePath, parser?.availablePattern, parser?.availableGroup ?? 1),
    remaining: hasQuotaData
      ? aggregate.remaining
      : readJsonOrTextValue(payload, text, parser?.remainingPath, parser?.remainingPattern, parser?.remainingGroup ?? 1) ?? quotaPair.remaining,
    limit: hasQuotaData
      ? aggregate.limit
      : readJsonOrTextValue(payload, text, parser?.limitPath, parser?.limitPattern, parser?.limitGroup ?? 1) ?? quotaPair.limit,
    spent: hasQuotaData
      ? aggregate.spent
      : readJsonOrTextValue(payload, text, parser?.spentPath, parser?.spentPattern, parser?.spentGroup ?? 1),
    currency: hasQuotaData
      ? aggregate.currency
      : readJsonOrTextValue(payload, text, parser?.currencyPath, parser?.currencyPattern, parser?.currencyGroup ?? 1),
    totalBalance: hasQuotaData
      ? aggregate.limit
      : readJsonOrTextValue(payload, text, parser?.totalBalancePath, parser?.totalBalancePattern, parser?.totalBalanceGroup ?? 1),
    grantedBalance: hasQuotaData
      ? aggregate.spent
      : readJsonOrTextValue(payload, text, parser?.grantedBalancePath, parser?.grantedBalancePattern, parser?.grantedBalanceGroup ?? 1),
    toppedUpBalance: hasQuotaData
      ? aggregate.remaining
      : readJsonOrTextValue(payload, text, parser?.toppedUpBalancePath, parser?.toppedUpBalancePattern, parser?.toppedUpBalanceGroup ?? 1),
    balanceInfos,
    balanceInfoCount: balanceInfos.length,
    updatedAt: hasQuotaData
      ? (payload?.data?.EndDate ?? payload?.EndDate ?? payload?.data?.StartDate ?? payload?.StartDate ?? null)
      : readJsonOrTextValue(payload, text, parser?.updatedAtPath, parser?.updatedAtPattern, parser?.updatedAtGroup ?? 1)
  };
}

function extractBillingQuotaEntries(payload) {
  const possibleLists = [
    payload?.data?.BillingQuotas,
    payload?.data?.billingQuotas,
    payload?.Data?.BillingQuotas,
    payload?.Data?.billingQuotas,
    payload?.BillingQuotas,
    payload?.billingQuotas
  ];

  for (const list of possibleLists) {
    if (!list) {
      continue;
    }

    if (Array.isArray(list)) {
      return list
        .map((item) => ({
          currency: item?.QuotaUnit ?? item?.quotaUnit ?? null,
          totalBalance: toNumberOrNull(item?.QuotaValue ?? item?.quotaValue),
          grantedBalance: toNumberOrNull(item?.UsedQuotaValue ?? item?.usedQuotaValue),
          toppedUpBalance: Math.max(
            0,
            (toNumberOrNull(item?.QuotaValue ?? item?.quotaValue) ?? 0) -
              (toNumberOrNull(item?.UsedQuotaValue ?? item?.usedQuotaValue) ?? 0)
          ),
          usedQuotaValue: toNumberOrNull(item?.UsedQuotaValue ?? item?.usedQuotaValue),
          quotaValue: toNumberOrNull(item?.QuotaValue ?? item?.quotaValue)
        }))
        .filter((item) => item.currency || item.totalBalance !== null || item.grantedBalance !== null);
    }

    if (typeof list === "object") {
      return Object.values(list)
        .map((item) => ({
          currency: item?.QuotaUnit ?? item?.quotaUnit ?? null,
          totalBalance: toNumberOrNull(item?.QuotaValue ?? item?.quotaValue),
          grantedBalance: toNumberOrNull(item?.UsedQuotaValue ?? item?.usedQuotaValue),
          toppedUpBalance: Math.max(
            0,
            (toNumberOrNull(item?.QuotaValue ?? item?.quotaValue) ?? 0) -
              (toNumberOrNull(item?.UsedQuotaValue ?? item?.usedQuotaValue) ?? 0)
          ),
          usedQuotaValue: toNumberOrNull(item?.UsedQuotaValue ?? item?.usedQuotaValue),
          quotaValue: toNumberOrNull(item?.QuotaValue ?? item?.quotaValue)
        }))
        .filter((item) => item.currency || item.totalBalance !== null || item.grantedBalance !== null);
    }
  }

  return [];
}

function toNumberOrNull(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function aggregateQuotaEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      currency: null,
      limit: null,
      spent: null,
      remaining: null
    };
  }

  const currency = entries.find((item) => item.currency)?.currency ?? null;
  const limit = entries.reduce((sum, item) => sum + (item.totalBalance ?? 0), 0);
  const spent = entries.reduce((sum, item) => sum + (item.grantedBalance ?? 0), 0);
  const remaining = entries.reduce((sum, item) => sum + (item.toppedUpBalance ?? 0), 0);

  return {
    currency,
    limit,
    spent,
    remaining
  };
}

function resolveDeepseekOrigin(provider) {
  try {
    return new URL(provider?.usageApi?.url ?? "https://platform.deepseek.com/usage").origin;
  } catch {
    return "https://platform.deepseek.com";
  }
}

function resolveDeepseekUsageUrls(provider, context) {
  const origin = resolveDeepseekOrigin(provider);
  const year = context.year;
  const month = context.month;
  const apis = provider.deepseekUsageApis ?? {};

  return {
    summaryUrl: applyTemplate(apis.summaryUrl ?? `${origin}/api/v0/users/get_user_summary`, context),
    amountUrl: applyTemplate(apis.amountUrl ?? `${origin}/api/v0/usage/amount?month=${month}&year=${year}`, context),
    costUrl: applyTemplate(apis.costUrl ?? `${origin}/api/v0/usage/cost?month=${month}&year=${year}`, context)
  };
}

function normalizeDeepseekBizPayload(payload) {
  const data = payload?.data ?? {};
  const bizCode = data?.biz_code;
  const bizMsg = data?.biz_msg;
  const rootCode = payload?.code;
  const rootMsg = payload?.msg;
  const bizDataRaw = data?.biz_data;
  const bizData = Array.isArray(bizDataRaw) ? (bizDataRaw[0] ?? {}) : (bizDataRaw ?? {});

  return {
    ok: rootCode === 0 && (bizCode === 0 || bizCode === undefined),
    rootCode,
    rootMsg,
    bizCode,
    bizMsg,
    bizData
  };
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function deepseekUsageArrayToMap(usage) {
  const map = {};
  for (const item of usage ?? []) {
    const type = String(item?.type ?? "").toUpperCase();
    if (!type) {
      continue;
    }
    map[type] = toNumber(item?.amount);
  }
  return map;
}

function detectDeepseekModelBucket(model) {
  const normalized = String(model ?? "").toLowerCase();
  if (!normalized) {
    return "other";
  }
  if (normalized.includes("deepseek-chat") && normalized.includes("deepseek-reasoner")) {
    return "combined";
  }
  if (normalized.includes("deepseek-chat")) {
    return "chat";
  }
  if (normalized.includes("deepseek-reasoner")) {
    return "reasoner";
  }
  return "other";
}

function buildEmptyModelTotals() {
  return {
    chat: { requests: 0, tokens: 0, cost: 0 },
    reasoner: { requests: 0, tokens: 0, cost: 0 },
    combined: { requests: 0, tokens: 0, cost: 0 },
    other: { requests: 0, tokens: 0, cost: 0 }
  };
}

function collectDeepseekDailySeries(amountBizData, costBizData) {
  const byDate = new Map();
  const modelTotals = buildEmptyModelTotals();

  const ensureDay = (date) => {
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        requests: 0,
        tokens: 0,
        cost: 0,
        chatRequests: 0,
        reasonerRequests: 0,
        chatTokens: 0,
        reasonerTokens: 0
      });
    }
    return byDate.get(date);
  };

  for (const day of amountBizData?.days ?? []) {
    const date = day?.date;
    if (!date) {
      continue;
    }
    const row = ensureDay(date);
    for (const modelItem of day?.data ?? []) {
      const usageMap = deepseekUsageArrayToMap(modelItem?.usage);
      const requests = usageMap.REQUEST ?? 0;
      const tokens =
        (usageMap.PROMPT_TOKEN ?? 0) +
        (usageMap.PROMPT_CACHE_HIT_TOKEN ?? 0) +
        (usageMap.PROMPT_CACHE_MISS_TOKEN ?? 0) +
        (usageMap.RESPONSE_TOKEN ?? 0);
      const bucket = detectDeepseekModelBucket(modelItem?.model);

      row.requests += requests;
      row.tokens += tokens;
      modelTotals[bucket].requests += requests;
      modelTotals[bucket].tokens += tokens;

      if (bucket === "chat") {
        row.chatRequests += requests;
        row.chatTokens += tokens;
      } else if (bucket === "reasoner") {
        row.reasonerRequests += requests;
        row.reasonerTokens += tokens;
      } else if (bucket === "combined") {
        row.chatRequests += requests;
        row.reasonerRequests += requests;
        row.chatTokens += tokens;
        row.reasonerTokens += tokens;
      }
    }
  }

  for (const day of costBizData?.days ?? []) {
    const date = day?.date;
    if (!date) {
      continue;
    }
    const row = ensureDay(date);
    for (const modelItem of day?.data ?? []) {
      const usageMap = deepseekUsageArrayToMap(modelItem?.usage);
      const modelCost = Object.values(usageMap).reduce((sum, value) => sum + toNumber(value), 0);
      const bucket = detectDeepseekModelBucket(modelItem?.model);
      row.cost += modelCost;
      modelTotals[bucket].cost += modelCost;
    }
  }

  const daily = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { daily, modelTotals };
}

async function fetchDeepseekJson(url, headers) {
  const response = await fetch(url, { method: "GET", headers });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return {
    ok: response.ok,
    statusCode: response.status,
    contentType,
    payload,
    url
  };
}

function isDeepseekAuthFailure(payload) {
  const code = payload?.code;
  const msg = String(payload?.msg ?? "");
  return code === 40002 || code === 40003 || /Missing Token|Authorization Failed|Not Login/i.test(msg);
}

async function collectDeepseekUsage(provider, context, warnings) {
  const referer = provider?.usageApi?.url ?? "https://platform.deepseek.com/usage";
  const headers = {
    ...buildHeaders(provider?.usageApi?.headers, context),
    Referer: referer
  };
  const { summaryUrl, amountUrl, costUrl } = resolveDeepseekUsageUrls(provider, context);

  const [summaryRes, amountRes, costRes] = await Promise.all([
    fetchDeepseekJson(summaryUrl, headers),
    fetchDeepseekJson(amountUrl, headers),
    fetchDeepseekJson(costUrl, headers)
  ]);

  const responses = [summaryRes, amountRes, costRes];
  if (responses.some((item) => !item.ok)) {
    const failed = responses.find((item) => !item.ok);
    return {
      state: "error",
      reason: `DeepSeek usage 接口请求失败: ${failed?.statusCode ?? "unknown"}`,
      url: failed?.url ?? summaryUrl,
      discoveryCandidates: [summaryUrl, amountUrl, costUrl]
    };
  }

  if ([summaryRes, amountRes, costRes].some((item) => isDeepseekAuthFailure(item.payload))) {
    return {
      state: "auth_required",
      reason: "DeepSeek usage 接口鉴权失败，请检查 Web Token / Cookie",
      url: summaryUrl,
      discoveryCandidates: [summaryUrl, amountUrl, costUrl]
    };
  }

  const summaryNormalized = normalizeDeepseekBizPayload(summaryRes.payload);
  const amountNormalized = normalizeDeepseekBizPayload(amountRes.payload);
  const costNormalized = normalizeDeepseekBizPayload(costRes.payload);

  if (!summaryNormalized.ok || !amountNormalized.ok || !costNormalized.ok) {
    return {
      state: "error",
      reason: "DeepSeek usage 返回 biz_code 非 0 或数据结构异常",
      url: summaryUrl,
      discoveryCandidates: [summaryUrl, amountUrl, costUrl]
    };
  }

  const summary = summaryNormalized.bizData ?? {};
  const { daily, modelTotals } = collectDeepseekDailySeries(amountNormalized.bizData, costNormalized.bizData);
  const monthlyCost = (summary.monthly_costs ?? []).reduce((sum, item) => sum + toNumber(item?.amount), 0);
  const rechargeBalance = (summary.normal_wallets ?? []).reduce((sum, item) => sum + toNumber(item?.balance), 0);
  const bonusBalance = (summary.bonus_wallets ?? []).reduce((sum, item) => sum + toNumber(item?.balance), 0);
  const monthlyTokenUsage = toNumber(summary.monthly_token_usage ?? summary.monthly_usage);
  const totalAvailableTokenEstimation = toNumber(summary.total_available_token_estimation);

  if (daily.length === 0) {
    warnings.push("DeepSeek usage 本月 days 数据为空，图表将显示为空");
  }

  return {
    state: "ok",
    url: summaryUrl,
    contentType: "application/json",
    discoveryCandidates: [summaryUrl, amountUrl, costUrl],
    metrics: {
      totalTokens: totalAvailableTokenEstimation,
      promptTokens: monthlyTokenUsage,
      completionTokens: toNumber(summary.total_usage),
      requestCount: daily.reduce((sum, item) => sum + toNumber(item.requests), 0),
      updatedAt: new Date().toISOString(),
      deepseek: {
        period: {
          year: context.year,
          month: context.month
        },
        summary: {
          rechargeBalance,
          bonusBalance,
          monthlyCost,
          monthlyTokenUsage,
          totalAvailableTokenEstimation,
          currentToken: toNumber(summary.current_token)
        },
        daily,
        modelTotals
      }
    }
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
    providerId: provider.id,
    sessionCookie: provider.sessionCookie,
    webToken: provider.webToken,
    userAgent: provider.userAgent,
    workspaceId: provider.workspaceId,
    region: provider.region ?? provider.workspaceId,
    collina: provider.collina ?? "",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  };

  const warnings = [];

  if (!provider.envDetected) {
    warnings.push("未找到 provider env 文件");
  }

  if (provider.id !== "deepseek" && !provider.apiKey) {
    warnings.push("未从 env 中读取到 API Key");
  }

  if (provider.id === "qwen" && !provider.collina) {
    warnings.push("Qwen collina 未配置");
  }

  if (provider.id === "deepseek" && !provider.webToken) {
    warnings.push("DeepSeek usage 网页 token 未配置（可在 deepseek.env 设置 COPILOT_DEEPSEEK_WEB_TOKEN）");
  }

  const [usageResult, balanceResult] = provider.id === "deepseek"
    ? await Promise.all([
        collectDeepseekUsage(provider, context, warnings).catch((error) => ({
          state: "error",
          reason: error.message
        })),
        Promise.resolve({
          state: "skipped",
          reason: "DeepSeek 已启用 usage-only 模式，不再采集 balance"
        })
      ])
    : await Promise.all([
        fetchResource(provider.usageApi, context, provider.parser?.usage, "usage").catch((error) => ({
          state: "error",
          reason: error.message
        })),
        fetchResource(provider.balanceApi, context, provider.parser?.balance, "balance").catch((error) => ({
          state: "error",
          reason: error.message
        }))
      ]);

  let status = "ready";

  if (provider.id === "deepseek") {
    if (usageResult.state === "skipped") {
      status = "needs_configuration";
    } else if (usageResult.state === "busy") {
      status = "busy";
    } else if (usageResult.state === "auth_required") {
      status = "auth_required";
    } else if (usageResult.state === "error" || usageResult.state === "no_xhr_found") {
      status = "partial";
    } else {
      status = "ready";
    }
  } else if (usageResult.state === "skipped" && balanceResult.state === "skipped") {
    status = "needs_configuration";
  } else if (usageResult.state === "busy" || balanceResult.state === "busy") {
    status = "busy";
  } else if (usageResult.state === "auth_required" || balanceResult.state === "auth_required") {
    status = "auth_required";
  } else if (
    usageResult.state === "error" ||
    balanceResult.state === "error" ||
    usageResult.state === "no_xhr_found" ||
    balanceResult.state === "no_xhr_found"
  ) {
    status = "partial";
  } else if (balanceResult.state === "ok" || usageResult.state === "ok") {
    const usageHasMetrics = Boolean(usageResult.metrics && hasParsedValue(usageResult.metrics));
    const balanceHasMetrics = Boolean(balanceResult.metrics && hasParsedValue(balanceResult.metrics));

    status = usageHasMetrics && balanceHasMetrics ? "ready" : "partial";
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
    sources: {
      usage: {
        preflightUrl: provider.usageApi?.preflightUrl ?? null,
        url: usageResult.url ?? null,
        contentType: usageResult.contentType ?? null,
        responseType: provider.usageApi?.responseType ?? "json",
        authConfigured: Boolean(provider.sessionCookie || provider.webToken),
        discoveredFrom: usageResult.discoveredFrom ?? null,
        discoveryCandidates: usageResult.discoveryCandidates ?? []
      },
      balance: {
        preflightUrl: provider.balanceApi?.preflightUrl ?? null,
        url: balanceResult.url ?? null,
        contentType: balanceResult.contentType ?? null,
        responseType: provider.balanceApi?.responseType ?? "json",
        authConfigured: Boolean(provider.sessionCookie || provider.webToken),
        discoveredFrom: balanceResult.discoveredFrom ?? null,
        discoveryCandidates: balanceResult.discoveryCandidates ?? []
      }
    },
    warnings,
    usage: {
      state: usageResult.state,
      error: usageResult.reason ?? null,
      authRequired: usageResult.state === "auth_required",
      metrics: usageResult.state === "ok"
        ? (usageResult.metrics ?? parseUsage(usageResult, provider.parser?.usage))
        : null
    },
    balance: {
      state: balanceResult.state,
      error: balanceResult.reason ?? null,
      authRequired: balanceResult.state === "auth_required",
      metrics: balanceResult.state === "ok"
        ? (balanceResult.metrics ?? parseBalance(balanceResult, provider.parser?.balance))
        : null
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
    platformFamily: config.platformFamily,
    platformLabel: config.platformLabel,
    providers
  };
}
