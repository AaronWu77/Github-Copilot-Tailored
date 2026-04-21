const refreshButton = document.getElementById("refresh-button");
const summaryCards = document.getElementById("summary-cards");
const configMeta = document.getElementById("config-meta");
const providerGrid = document.getElementById("provider-grid");
const providerCardTemplate = document.getElementById("provider-card-template");

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function formatBooleanValue(value) {
  if (value === true) {
    return "可用";
  }

  if (value === false) {
    return "不可用";
  }

  return "-";
}

function formatBalanceDetails(balanceInfos) {
  if (!Array.isArray(balanceInfos) || balanceInfos.length === 0) {
    return "当前接口未返回更多余额明细。";
  }

  return balanceInfos
    .map((item) => {
      const currency = item.currency ?? "-";
      const total = item.totalBalance ?? "-";
      const granted = item.grantedBalance ?? "-";
      const toppedUp = item.toppedUpBalance ?? "-";
      return `${currency}: 总余额 ${total}, 赠金 ${granted}, 充值 ${toppedUp}`;
    })
    .join(" | ");
}

function statusLabel(status) {
  switch (status) {
    case "ready":
      return "已连接";
    case "partial":
      return "部分可用";
    case "needs_configuration":
      return "待配置";
    case "disabled":
      return "已禁用";
    default:
      return "未知";
  }
}

function createSummaryCard(label, value) {
  const card = document.createElement("article");
  card.className = "summary-card";
  card.innerHTML = `<p>${label}</p><strong>${value}</strong>`;
  return card;
}

function renderSummary(snapshot) {
  const total = snapshot.providers.length;
  const ready = snapshot.providers.filter((provider) => provider.status === "ready").length;
  const partial = snapshot.providers.filter((provider) => provider.status === "partial").length;
  const pending = snapshot.providers.filter((provider) => provider.status === "needs_configuration").length;

  summaryCards.innerHTML = "";
  summaryCards.append(
    createSummaryCard("Provider 总数", total),
    createSummaryCard("已连接", ready),
    createSummaryCard("部分可用", partial),
    createSummaryCard("待配置", pending)
  );
}

function renderConfigMeta(snapshot) {
  const list = document.createElement("ul");
  list.innerHTML = `
    <li><strong>当前配置:</strong> ${formatValue(snapshot.configPath)}</li>
    <li><strong>轮询间隔:</strong> ${snapshot.pollingIntervalMs} ms</li>
    <li><strong>最近快照:</strong> ${formatValue(snapshot.generatedAt)}</li>
    <li><strong>候选配置路径:</strong> ${snapshot.candidatePaths.map((item) => `<code>${item}</code>`).join("，") || "-"}</li>
  `;
  configMeta.innerHTML = "";
  configMeta.appendChild(list);
}

function renderProviderCard(provider) {
  const fragment = providerCardTemplate.content.cloneNode(true);
  fragment.querySelector(".provider-name").textContent = provider.name;
  fragment.querySelector(".provider-model").textContent = provider.model || "未读取到 model";
  fragment.querySelector(".provider-base-url").textContent = provider.baseUrl || "未读取到 base_url";
  fragment.querySelector(".provider-env-file").textContent = provider.envFile || "未找到";

  const chip = fragment.querySelector(".status-chip");
  chip.textContent = statusLabel(provider.status);
  chip.dataset.status = provider.status;

  fragment.querySelector(".metric-balance-available").textContent = formatBooleanValue(provider.balance.metrics?.available);
  fragment.querySelector(".metric-balance-currency").textContent = formatValue(provider.balance.metrics?.currency);
  fragment.querySelector(".metric-balance-total").textContent = formatValue(provider.balance.metrics?.totalBalance);
  fragment.querySelector(".metric-balance-granted").textContent = formatValue(provider.balance.metrics?.grantedBalance);
  fragment.querySelector(".metric-balance-topped-up").textContent = formatValue(provider.balance.metrics?.toppedUpBalance);
  fragment.querySelector(".metric-balance-entry-count").textContent = formatValue(provider.balance.metrics?.balanceInfoCount);
  fragment.querySelector(".metric-balance-checked-at").textContent = formatValue(provider.checkedAt);

  const balanceMessage = fragment.querySelector(".balance-message");
  const balanceDetails = fragment.querySelector(".balance-details");

  if (provider.balance.state === "ok") {
    balanceMessage.textContent = `Balance API 已返回数据，最近检查时间：${provider.checkedAt}`;
    balanceDetails.textContent = `余额明细：${formatBalanceDetails(provider.balance.metrics?.balanceInfos)}`;
  } else {
    balanceMessage.textContent = `Balance API 状态：${provider.balance.state}${provider.balance.error ? ` - ${provider.balance.error}` : ""}`;
    balanceDetails.textContent = "DeepSeek 当前公开的余额接口不提供当天 token 数和请求数。若要统计这两项，需要在请求链路中采集每次调用的 usage。";
  }

  const warningList = fragment.querySelector(".warning-list");
  warningList.innerHTML = "";
  for (const warning of provider.warnings ?? []) {
    const item = document.createElement("li");
    item.textContent = warning;
    warningList.appendChild(item);
  }

  return fragment;
}

function renderProviders(snapshot) {
  providerGrid.innerHTML = "";
  for (const provider of snapshot.providers) {
    providerGrid.appendChild(renderProviderCard(provider));
  }
}

async function loadSnapshot(forceRefresh = false) {
  const response = await fetch(`/api/snapshot${forceRefresh ? "?refresh=1" : ""}`);
  if (!response.ok) {
    throw new Error(`加载快照失败: ${response.status}`);
  }

  const snapshot = await response.json();
  renderSummary(snapshot);
  renderConfigMeta(snapshot);
  renderProviders(snapshot);
}

refreshButton.addEventListener("click", () => {
  loadSnapshot(true).catch((error) => {
    window.alert(error.message);
  });
});

loadSnapshot().catch((error) => {
  configMeta.textContent = error.message;
});

setInterval(() => {
  loadSnapshot().catch(() => {});
}, 15000);
