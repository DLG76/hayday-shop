// ================= ตั้งค่า API =================
const SHEETDB_URL = 'https://sheetdb.io/api/v1/bhfhitw4gwpbt';

// ================= ตั้งค่าหมวดเหรียญ =================
// จำนวนเหรียญที่ให้เลือกซื้อ (ราคาของแต่ละจำนวนอ่านจากคอลัมน์ในชีต coin)
const COIN_AMOUNTS = [
  { amount: 100000,  label: "1 แสน",  priceKey: "price_100k" },
  { amount: 500000,  label: "5 แสน",  priceKey: "price_500k" },
  { amount: 1000000, label: "1 ล้าน", priceKey: "price_1m" }
];
// แท็บสต็อกเหรียญกลาง (1 แถว): คอลัมน์ id = main, stock_coins = จำนวนเหรียญคงเหลือ
const COIN_STOCK_SHEET = 'coin_stock';
const COIN_STOCK_ROW_ID = 'main';

// ================= ตั้งค่าชื่อหมวดหมู่และสี (Dynamic Theme) =================
const CATEGORY_NAMES = {
  "upgrade": "ไอเท็มอัปเกรด",
  "coin": "วนเหรียญ",
  "decor": "ของตกแต่ง"
};

const CATEGORY_COLORS = {
  "upgrade": { main: "#4d9b55", text: "#ffffff", hover: "#2f7640", light: "#eaf7e6", lightText: "#356a47" },
  "coin": { main: "#67b9db", text: "#ffffff", hover: "#477b91", light: "#eaf8fd", lightText: "#477b91" },
  "decor": { main: "#ffb9a5", text: "#6e3529", hover: "#d5765e", light: "#fff1ed", lightText: "#ad5545" },
  "default": { main: "#ffc944", text: "#594300", hover: "#d4a02c", light: "#fff0ad", lightText: "#76540c" }
};

// ================= ข้อมูลสินค้าและสถานะ =================
let allProducts = [];
let currentCategory = "";
let coinStock = 0; // เหรียญคงเหลือรวม (ใช้ร่วมกันทุก level)
const appSettings = { music_url: "" };
const cartState = { items: [] };
let musicAudio = null;

// ================= 1. ฟังก์ชันดึงข้อมูลจากชีต =================
function parseNumber(value) {
  return Number(String(value ?? '').replace(/,/g, '').trim()) || 0;
}

async function fetchCoinStock() {
  const res = await fetch(`${SHEETDB_URL}?sheet=${COIN_STOCK_SHEET}&t=${Date.now()}`, { cache: 'no-store' });
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return 0;
  const row = data.find(r => String(r.id).trim() === COIN_STOCK_ROW_ID) || data[0];
  return parseNumber(row.stock_coins);
}

async function loadDataFromSheetDB() {
  if (SHEETDB_URL === 'ใส่_URL_ของ_SHEETDB_ตรงนี้') {
    document.getElementById("loading-state").classList.add("hidden");
    document.getElementById("error-state").classList.remove("hidden");
    document.getElementById("error-state").innerHTML = "<p class='font-semibold text-[#ad5545]'>กรุณาใส่ URL ของ SheetDB ในไฟล์ script.js</p>";
    return;
  }

  try {
    const [stockResponse, coinResponse, stockCoins] = await Promise.all([
      fetch(SHEETDB_URL + '?sheet=Stock'),
      fetch(SHEETDB_URL + '?sheet=coin'),
      fetchCoinStock().catch(err => { console.error("Error fetching coin stock:", err); return 0; })
    ]);

    const stockData = await stockResponse.json();
    const coinData = await coinResponse.json();
    coinStock = stockCoins;

    let rawData = [];
    if (!stockData.error) rawData = rawData.concat(stockData.map(item => ({ ...item, sheetName: 'Stock' })));
    // แถวในชีต coin ทั้งหมดถือเป็นหมวด "coin" (1 แถว = 1 ช่วงเลเวล)
    if (!coinData.error) rawData = rawData.concat(coinData.map(item => ({ ...item, category: 'coin', sheetName: 'coin' })));

    allProducts = rawData.map(item => ({
      ...item,
      price: parseNumber(item.price),
      price_select: parseNumber(item.price_select),
      price_pure: parseNumber(item.price_pure),
      price_100k: parseNumber(item.price_100k),
      price_500k: parseNumber(item.price_500k),
      price_1m: parseNumber(item.price_1m),
      pack_amount: parseNumber(item.pack_amount) || 89,
      stock_quantity: parseNumber(item.stock_quantity),
      active: String(item.active).toLowerCase() === 'true',
      items: item.items ? item.items.split(',').map(i => i.trim()).filter(i => i !== '') : []
    })).filter(product => product.active);

    renderDynamicCategories();
    document.getElementById("loading-state").classList.add("hidden");
  } catch (error) {
    console.error("Error fetching data:", error);
    document.getElementById("loading-state").classList.add("hidden");
    document.getElementById("error-state").classList.remove("hidden");
  }
}

// ================= 2. ฟังก์ชันสร้างแท็บอัตโนมัติ =================
function renderDynamicCategories() {
  const tabsContainer = document.getElementById("dynamic-tabs-container");
  const viewsContainer = document.getElementById("dynamic-views-container");
  tabsContainer.innerHTML = '';
  viewsContainer.innerHTML = '';

  const categories = [...new Set(allProducts.map(p => p.category))];

  if (categories.length === 0) {
    document.getElementById("empty-state").classList.remove("hidden");
    return;
  } else {
    document.getElementById("empty-state").classList.add("hidden");
  }

  categories.forEach((cat, index) => {
    const displayName = CATEGORY_NAMES[cat] || cat;

    const tabBtn = document.createElement("button");
    tabBtn.type = "button";
    tabBtn.dataset.targetCat = cat;
    tabBtn.className = "canva-button flex-1 rounded-2xl px-5 py-3 font-bold whitespace-nowrap transition-all shadow-sm";
    tabBtn.textContent = displayName;
    tabBtn.onclick = () => switchCategory(cat);
    tabsContainer.appendChild(tabBtn);

    const viewDiv = document.createElement("div");
    viewDiv.id = `view-${cat}`;
    viewDiv.className = index === 0 ? "mt-7" : "hidden mt-7";

    const gridDiv = document.createElement("div");
    gridDiv.className = "grid grid-cols-1 gap-5 lg:grid-cols-3";
    viewDiv.appendChild(gridDiv);
    viewsContainer.appendChild(viewDiv);

    const productsInCat = allProducts.filter(p => p.category === cat);

    productsInCat.forEach(product => {
      if (cat === 'coin') {
        renderCoinTierCard(product, gridDiv);
      } else if (product.items && product.items.length > 0) {
        renderPackProductCard(product, gridDiv);
      } else {
        renderSimpleProductCard(product, gridDiv);
      }
    });
  });

  refreshCoinUI();
  if (categories.length > 0) switchCategory(categories[0]);
}

function switchCategory(category) {
  currentCategory = category;
  document.querySelectorAll("#dynamic-tabs-container button").forEach(btn => {
    const cat = btn.dataset.targetCat;
    const theme = CATEGORY_COLORS[cat] || CATEGORY_COLORS["default"];
    if (cat === category) {
      btn.style.backgroundColor = theme.main;
      btn.style.color = theme.text;
      btn.style.transform = "translateY(-2px)";
    } else {
      btn.style.backgroundColor = "#ffffff";
      btn.style.color = "#3c7067";
      btn.style.transform = "none";
    }
  });

  document.querySelectorAll("#dynamic-views-container > div").forEach(view => {
    if (view.id === `view-${category}`) {
      view.classList.remove("hidden");
    } else {
      view.classList.add("hidden");
    }
  });
}

// ================= ตัวเลือกจำนวนชุด (ใช้กับทุกการ์ดสินค้า) =================
function attachQtyStepper(card, beforeEl, maxQty, disabled) {
  const wrap = document.createElement("div");
  wrap.className = "qty-stepper mt-4 flex items-center justify-between gap-3";
  wrap.innerHTML = `
    <span class="text-sm font-bold text-[#496555]">จำนวนชุด</span>
    <div class="flex items-center gap-2">
      <button type="button" class="qty-minus rounded-lg bg-[#edf5e9] px-3 py-1.5 font-bold text-[#356a47] disabled:opacity-40 disabled:cursor-not-allowed" aria-label="ลดจำนวนชุด">−</button>
      <input type="number" class="set-qty-input w-16 rounded-xl border border-[#cfe0ca] px-2 py-1.5 text-center font-bold disabled:opacity-40" min="1" step="1" value="1" inputmode="numeric" aria-label="จำนวนชุด">
      <button type="button" class="qty-plus rounded-lg bg-[#edf5e9] px-3 py-1.5 font-bold text-[#356a47] disabled:opacity-40 disabled:cursor-not-allowed" aria-label="เพิ่มจำนวนชุด">+</button>
    </div>`;
  beforeEl.parentNode.insertBefore(wrap, beforeEl);

  // การ์ดที่ไม่มีช่องข้อความแจ้งเตือน ให้เพิ่มให้
  if (!card.querySelector(".validation-message")) {
    const msg = document.createElement("p");
    msg.className = "validation-message hidden";
    msg.setAttribute("aria-live", "polite");
    beforeEl.parentNode.insertBefore(msg, beforeEl);
  }

  if (maxQty > 0) card.dataset.maxQty = String(maxQty);
  wrap.querySelector(".qty-minus").addEventListener("click", () => setQty(card, getQty(card) - 1));
  wrap.querySelector(".qty-plus").addEventListener("click", () => setQty(card, getQty(card) + 1));
  wrap.querySelector(".set-qty-input").addEventListener("change", () => setQty(card, getQty(card)));
  setQtyDisabled(card, !!disabled);
}

function getQty(card) {
  const el = card.querySelector(".set-qty-input");
  const n = Math.floor(Number(el ? el.value : 1));
  return n >= 1 ? n : 1;
}

function setQty(card, n) {
  const el = card.querySelector(".set-qty-input");
  if (!el) return;
  const max = Number(card.dataset.maxQty) || Infinity;
  el.value = Math.min(Math.max(1, Math.floor(n) || 1), max);
}

function setQtyDisabled(card, disabled) {
  card.querySelectorAll(".qty-minus, .qty-plus, .set-qty-input").forEach(el => { el.disabled = disabled; });
}

// ================= 2.5 หมวดเหรียญ: 3 ช่อง (ช่วงเลเวล) x เลือก 1 แสน / 5 แสน / 1 ล้าน =================
function coinsInCart() {
  return cartState.items.reduce((sum, item) => sum + (item.coinAmount || 0) * item.quantity, 0);
}

function formatCoins(value) {
  return `${Number(value).toLocaleString("th-TH")} เหรียญ`;
}

function renderCoinTierCard(tier, container) {
  const fragment = document.getElementById("upgrade-card-template").content.cloneNode(true);
  const card = fragment.querySelector("article");
  const theme = CATEGORY_COLORS.coin;

  card.classList.add("coin-tier-card");
  card.dataset.tierId = tier.id;
  card.dataset.amount = "";

  card.querySelector(".upgrade-category").textContent = tier.subcategory || "";
  card.querySelector(".upgrade-name").textContent = tier.name;
  setupImage(card.querySelector(".product-image-wrap"), tier.image_url, tier.name);

  const headerLine = card.querySelector("div.h-2");
  if (headerLine) headerLine.style.backgroundColor = theme.main;

  // ข้อความสต็อกเหรียญกลาง (ใช้ที่เดิมของ demo-stock-note)
  const stockNote = card.querySelector(".demo-stock-note");
  stockNote.classList.add("coin-stock-live");
  stockNote.classList.remove("text-xs");
  stockNote.classList.add("text-sm", "font-semibold");
  stockNote.style.color = theme.lightText;

  // ปุ่มเลือกจำนวนเหรียญ
  const choices = card.querySelector(".pack-choices");
  choices.innerHTML = "";
  COIN_AMOUNTS.forEach(opt => {
    const price = tier[opt.priceKey];
    if (!(price > 0)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pack-choice rounded-xl border-2 px-1 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40";
    button.dataset.amount = opt.amount;
    button.dataset.price = price;
    button.innerHTML = `${opt.label}<br><span class="font-semibold">${price.toLocaleString("th-TH")}฿</span>`;
    button.addEventListener("click", () => {
      card.dataset.amount = String(opt.amount);
      setValidation(card, "", false);
      updateCoinCard(card);
    });
    choices.appendChild(button);
  });

  const addBtn = card.querySelector(".add-upgrade");
  attachQtyStepper(card, addBtn, 0, false);
  addBtn.addEventListener("click", () => addCoinToCart(card, tier));
  addBtn.onmouseenter = () => { if (!addBtn.disabled) addBtn.style.backgroundColor = theme.hover; };
  addBtn.onmouseleave = () => { if (!addBtn.disabled) addBtn.style.backgroundColor = theme.main; };

  container.appendChild(fragment);
  updateCoinCard(container.lastElementChild);
}

function updateCoinCard(card) {
  const theme = CATEGORY_COLORS.coin;
  const remaining = coinStock - coinsInCart();
  const buttons = [...card.querySelectorAll(".pack-choice")];

  // ถ้าจำนวนที่เลือกไว้เกินเหรียญคงเหลือ ให้เลือกตัวเลือกแรกที่ซื้อได้แทน
  let selected = Number(card.dataset.amount) || 0;
  if (!selected || selected > remaining) {
    const firstOk = buttons.find(b => Number(b.dataset.amount) <= remaining);
    selected = firstOk ? Number(firstOk.dataset.amount) : 0;
    card.dataset.amount = selected ? String(selected) : "";
  }

  buttons.forEach(button => {
    const amount = Number(button.dataset.amount);
    const canBuy = amount <= remaining;
    button.disabled = !canBuy;
    if (amount === selected) {
      button.style.borderColor = theme.main;
      button.style.backgroundColor = theme.light;
      button.style.color = theme.lightText;
    } else {
      button.style.borderColor = "#e2eadf";
      button.style.backgroundColor = "#ffffff";
      button.style.color = "#597260";
    }
  });

  const minAmount = Math.min(...COIN_AMOUNTS.map(o => o.amount));
  const available = coinStock >= minAmount;

  const badge = card.querySelector(".stock-badge");
  badge.textContent = available ? "พร้อมขาย" : "สินค้าหมด";
  badge.style.backgroundColor = available ? theme.light : "#ffe0d9";
  badge.style.color = available ? theme.lightText : "#a85242";

  const addBtn = card.querySelector(".add-upgrade");
  const canAdd = available && selected > 0;

  // จำนวนชุดสูงสุดที่ซื้อได้ = เหรียญคงเหลือ (หักของในตะกร้า) / เหรียญต่อชุด
  card.dataset.maxQty = String(selected > 0 ? Math.max(1, Math.floor(remaining / selected)) : 1);
  setQty(card, getQty(card));
  setQtyDisabled(card, !canAdd);

  addBtn.disabled = !canAdd;
  addBtn.style.backgroundColor = canAdd ? theme.main : "#a6b8a4";
  addBtn.style.color = canAdd ? theme.text : "#ffffff";
}

// อัปเดตการ์ดเหรียญทุกใบ + ข้อความสต็อกกลาง (เรียกทุกครั้งที่สต็อกหรือตะกร้าเปลี่ยน)
function refreshCoinUI() {
  document.querySelectorAll(".coin-stock-live").forEach(el => {
    el.textContent = `เหรียญคงเหลือ: ${formatCoins(coinStock)}`;
  });
  document.querySelectorAll(".coin-tier-card").forEach(updateCoinCard);
}

function addCoinToCart(card, tier) {
  const amount = Number(card.dataset.amount) || 0;
  const opt = COIN_AMOUNTS.find(o => o.amount === amount);
  if (!opt) return setValidation(card, "กรุณาเลือกจำนวนเหรียญ", true);

  const qty = getQty(card);
  const ok = addCartItem({
    cartId: `coin-${tier.id}-${amount}`,
    productId: tier.id,
    name: tier.name,
    group: tier.subcategory,
    packLabel: `${opt.label} (${amount.toLocaleString("th-TH")} เหรียญ)`,
    details: `${tier.subcategory || tier.name} · ${formatCoins(amount)}`,
    unitPrice: tier[opt.priceKey],
    stock: Infinity,
    coinAmount: amount,
    sheetName: 'coin'
  }, qty);

  if (ok) {
    setQty(card, 1);
    setValidation(card, `เพิ่มลงตะกร้าแล้ว ${qty} ชุด 🌻`, false);
  } else {
    setValidation(card, "เหรียญคงเหลือไม่พอสำหรับจำนวนนี้", true);
  }
}

// ================= 3. วาดการ์ดสินค้าแบบแพ็กเกจ =================
function renderPackProductCard(product, container) {
  const fragment = document.getElementById("upgrade-card-template").content.cloneNode(true);
  const card = fragment.querySelector("article");
  const theme = CATEGORY_COLORS[product.category] || CATEGORY_COLORS["default"];

  card.dataset.productId = product.id;
  card.querySelector(".upgrade-category").textContent = product.subcategory;
  card.querySelector(".upgrade-name").textContent = product.name;
  setupImage(card.querySelector(".product-image-wrap"), product.image_url, product.name);

  const headerLine = card.querySelector("div.h-2");
  if (headerLine) headerLine.style.backgroundColor = theme.main;

  const badge = card.querySelector(".stock-badge");
  const available = isAvailable(product);
  badge.textContent = available ? "พร้อมขาย" : "สินค้าหมด";
  if (available) {
    badge.style.backgroundColor = theme.light;
    badge.style.color = theme.lightText;
  } else {
    badge.style.backgroundColor = "#ffe0d9";
    badge.style.color = "#a85242";
  }

  const choices = card.querySelector(".pack-choices");
  choices.innerHTML = "";
  const packTypes = [
    { key: "mixed", label: "แบบคละ", price: product.price },
    { key: "select", label: "แบบเลือก", price: product.price_select },
    { key: "pure", label: "แบบล้วน", price: product.price_pure }
  ];

  packTypes.forEach((pack) => {
    if (pack.price > 0) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `pack-choice rounded-xl border-2 px-1 py-2 text-xs font-bold transition`;
      button.dataset.packKey = pack.key;
      button.textContent = `${pack.label} ${pack.price}฿`;
      button.addEventListener("click", () => selectPack(card, product, pack.key));
      choices.appendChild(button);
    }
  });

  const addBtn = card.querySelector(".add-upgrade");
  addBtn.disabled = !available;
  addBtn.style.backgroundColor = available ? theme.main : "#a6b8a4";
  addBtn.style.color = available ? theme.text : "#ffffff";
  addBtn.onmouseenter = () => { if (available) addBtn.style.backgroundColor = theme.hover; };
  addBtn.onmouseleave = () => { if (available) addBtn.style.backgroundColor = theme.main; };
  attachQtyStepper(card, addBtn, Number(product.stock_quantity), !available);
  addBtn.addEventListener("click", () => addUpgradeToCart(card, product));

  container.appendChild(fragment);
  selectPack(container.lastElementChild, product, "mixed");
}

function selectPack(card, product, packKey) {
  const theme = CATEGORY_COLORS[product.category] || CATEGORY_COLORS["default"];
  card.dataset.packKey = packKey;

  card.querySelectorAll(".pack-choice").forEach(button => {
    if (button.dataset.packKey === packKey) {
      button.style.borderColor = theme.main;
      button.style.backgroundColor = theme.light;
      button.style.color = theme.lightText;
    } else {
      button.style.borderColor = "#e2eadf";
      button.style.backgroundColor = "#ffffff";
      button.style.color = "#597260";
    }
  });

  const allocation = card.querySelector(".allocation");
  const mixNote = card.querySelector(".mix-note");
  mixNote.classList.add("hidden");
  allocation.classList.add("hidden");
  allocation.innerHTML = "";

  if (packKey === "mixed") {
    mixNote.classList.remove("hidden");
    setValidation(card, "", false);
  } else if (packKey === "select") {
    allocation.classList.remove("hidden");
    product.items.forEach((item) => {
      const row = document.createElement("label");
      row.className = "mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-[#496555]";
      row.innerHTML = `<span>${item}</span><input class="allocation-input qty-input w-20 rounded-xl border border-[#cfe0ca] px-2 py-1.5 text-center" type="number" min="0" max="${product.pack_amount}" step="1" value="0" data-item="${item}">`;
      allocation.appendChild(row);
    });
    const total = document.createElement("p");
    total.className = "allocation-total mt-2 rounded-xl px-3 py-2 text-sm font-bold";
    allocation.appendChild(total);
    allocation.querySelectorAll(".allocation-input").forEach(input => input.addEventListener("input", () => validateAllocation(card, product, packKey)));
    validateAllocation(card, product, packKey);
  } else if (packKey === "pure") {
    allocation.classList.remove("hidden");
    const title = document.createElement("p");
    title.className = "mb-2 text-sm font-bold text-[#496555]";
    title.textContent = `เลือกไอเท็มที่ต้องการ (ล้วน ${product.pack_amount} ชิ้น)`;
    allocation.appendChild(title);

    const selectBox = document.createElement("select");
    selectBox.className = "pure-select w-full rounded-xl border border-[#cfe0ca] px-3 py-2 text-sm font-semibold text-[#356a47]";
    product.items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      selectBox.appendChild(option);
    });
    allocation.appendChild(selectBox);
    setValidation(card, "", false);
  }
}

function validateAllocation(card, product, packKey) {
  if (packKey === "select") {
    const theme = CATEGORY_COLORS[product.category] || CATEGORY_COLORS["default"];
    const inputs = [...card.querySelectorAll(".allocation-input")];
    const values = inputs.map(input => Number(input.value));
    const invalid = values.some(value => !Number.isInteger(value) || value < 0);
    const total = values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
    const totalEl = card.querySelector(".allocation-total");

    if (totalEl) {
      totalEl.textContent = `รวม ${total}/${product.pack_amount} ชิ้น`;
      const valid = !invalid && total === product.pack_amount;
      if (valid) {
        totalEl.style.backgroundColor = theme.light;
        totalEl.style.color = theme.lightText;
      } else {
        totalEl.style.backgroundColor = "#fff1ed";
        totalEl.style.color = "#ad5545";
      }
      setValidation(card, valid ? "" : `กรุณาระบุจำนวนให้ครบ ${product.pack_amount} ชิ้น`, !valid);
      return valid;
    }
  }
  return true;
}

function addUpgradeToCart(card, product) {
  const packKey = card.dataset.packKey || "mixed";
  if (!isAvailable(product)) return setValidation(card, "สินค้านี้ยังไม่มีสต็อกสำหรับเพิ่มลงตะกร้า", true);

  let details = "ร้านค้าจะคละสินค้าให้";
  let packLabel = "แบบคละ";
  let packPrice = product.price;

  if (packKey === "select") {
    if (!validateAllocation(card, product, packKey)) return;
    const inputs = [...card.querySelectorAll(".allocation-input")];
    details = inputs.map(input => `${input.dataset.item} ${input.value} ชิ้น`).filter(text => !text.includes(" 0 ชิ้น")).join(" • ");
    packLabel = "แบบเลือก";
    packPrice = product.price_select;
  } else if (packKey === "pure") {
    const selectedItem = card.querySelector(".pure-select").value;
    details = `${selectedItem} ล้วน ${product.pack_amount} ชิ้น`;
    packLabel = "แบบล้วน";
    packPrice = product.price_pure;
  }

  const cartId = `${product.id}-${packKey}-${details}`;
  const qty = getQty(card);
  const ok = addCartItem({
    cartId,
    productId: product.id,
    name: product.name,
    group: product.subcategory,
    packLabel: packLabel,
    details,
    unitPrice: packPrice,
    stock: product.stock_quantity,
    sheetName: product.sheetName
  }, qty);

  if (ok) {
    setQty(card, 1);
    setValidation(card, `เพิ่มลงตะกร้าแล้ว ${qty} ชุด 🌻`, false);
  } else {
    setValidation(card, `เกินสต็อกที่มี (เหลือ ${product.stock_quantity} ชุด รวมที่อยู่ในตะกร้าแล้ว)`, true);
  }
}

// ================= 4. วาดการ์ดปกติ (ชิ้นเดี่ยว) =================
function renderSimpleProductCard(product, container) {
  const fragment = document.getElementById("coin-card-template").content.cloneNode(true);
  const card = fragment.querySelector("article");
  const theme = CATEGORY_COLORS[product.category] || CATEGORY_COLORS["default"];

  card.querySelector(".coin-level").textContent = product.subcategory || product.category;
  card.querySelector(".coin-name").textContent = product.name;
  card.querySelector(".coin-price").textContent = formatBaht(product.price);
  card.querySelector(".coin-stock").textContent = `สต็อกคงเหลือ: ${stockText(product.stock_quantity)}`;
  setupImage(card.querySelector(".product-image-wrap"), product.image_url, product.name);

  const headerLine = card.querySelector("div.h-2");
  if (headerLine) headerLine.style.backgroundColor = theme.main;

  const badge = card.querySelector(".stock-badge");
  const available = isAvailable(product);
  badge.textContent = available ? "พร้อมขาย" : "สินค้าหมด";
  if (available) {
    badge.style.backgroundColor = theme.light;
    badge.style.color = theme.lightText;
  } else {
    badge.style.backgroundColor = "#ffe0d9";
    badge.style.color = "#a85242";
  }

  const addBtn = card.querySelector(".add-coin");
  addBtn.disabled = !available;
  addBtn.style.backgroundColor = available ? theme.main : "#a6b8a4";
  addBtn.style.color = available ? theme.text : "#ffffff";
  addBtn.onmouseenter = () => { if (available) addBtn.style.backgroundColor = theme.hover; };
  addBtn.onmouseleave = () => { if (available) addBtn.style.backgroundColor = theme.main; };

  attachQtyStepper(card, addBtn, Number(product.stock_quantity), !available);
  addBtn.addEventListener("click", () => {
    const qty = getQty(card);
    const ok = addCartItem({
      cartId: product.id,
      productId: product.id,
      name: product.name,
      group: product.subcategory,
      packLabel: product.amount ? `จำนวน ${product.amount}` : `1 ชิ้น`,
      details: product.amount ? `รายละเอียด: ${product.amount}` : "สินค้าจำนวน 1 ชุด",
      unitPrice: product.price,
      stock: product.stock_quantity,
      sheetName: product.sheetName
    }, qty);

    if (ok) {
      setQty(card, 1);
      setValidation(card, `เพิ่มลงตะกร้าแล้ว ${qty} ชุด 🌻`, false);
    } else {
      setValidation(card, `เกินสต็อกที่มี (เหลือ ${product.stock_quantity} ชุด รวมที่อยู่ในตะกร้าแล้ว)`, true);
    }
  });

  container.appendChild(fragment);
}

// ================= ฟังก์ชันช่วยเหลือทั่วไป =================
function formatBaht(value) { return `${value.toLocaleString("th-TH")} บาท`; }
function stockText(stock) { return stock === null || isNaN(stock) ? "ยังไม่ระบุ" : `${stock} ชุด`; }
function isAvailable(product) { return product.active && Number(product.stock_quantity) > 0; }

function setupImage(wrapper, imageUrl, label) {
  const img = wrapper.querySelector(".product-image");
  const placeholder = wrapper.querySelector(".image-placeholder");
  if (imageUrl && String(imageUrl).trim()) {
    img.src = imageUrl;
    img.alt = label;
    img.classList.remove("hidden");
    placeholder.classList.add("hidden");
  }
}

function setValidation(card, message, isError) {
  const messageEl = card.querySelector(".validation-message");
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.classList.toggle("hidden", !message);
  messageEl.className = `validation-message mt-3 rounded-xl px-3 py-2 text-sm ${message ? (isError ? "bg-[#fff1ed] text-[#ad5545]" : "bg-[#eaf7e6] text-[#356a47]") : "hidden"}`;
}

// ================= 5. ระบบจัดการตะกร้า =================
// คืนค่า true ถ้าเพิ่มสำเร็จ
function addCartItem(newItem, qty = 1) {
  const existing = cartState.items.find(item => item.cartId === newItem.cartId);

  if (newItem.coinAmount) {
    // เหรียญ: สต็อกใช้ร่วมกันทั้งหมด เช็กจากยอดเหรียญรวมในตะกร้า
    if (coinsInCart() + newItem.coinAmount * qty > coinStock) return false;
  } else if ((existing ? existing.quantity : 0) + qty > newItem.stock) {
    return false;
  }

  if (existing) {
    existing.quantity += qty;
  } else {
    cartState.items.push({ ...newItem, quantity: qty });
  }
  renderCart();
  return true;
}

function renderCart() {
  const itemsEl = document.getElementById("cart-items");
  itemsEl.replaceChildren();

  const empty = cartState.items.length === 0;
  document.getElementById("cart-empty").classList.toggle("hidden", !empty);
  itemsEl.classList.toggle("hidden", empty);

  cartState.items.forEach(item => {
    const row = document.createElement("article");
    row.className = "mb-3 rounded-2xl border border-[#e1ebdd] bg-white p-3";
    row.innerHTML = `
      <div class="flex justify-between gap-3">
        <div><h3 class="font-bold text-[#356a47]">${item.name}</h3><p class="text-xs text-[#687e70]">${item.group} · ${item.packLabel}</p></div>
        <button type="button" class="remove-item rounded-lg p-1 text-[#c86656]" aria-label="ลบสินค้า"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
      <p class="mt-2 text-xs text-[#718276]">${item.details}</p>
      <div class="mt-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button type="button" class="decrease rounded-lg bg-[#edf5e9] px-2 py-1 text-[#356a47]" aria-label="ลดจำนวน">−</button>
          <span class="min-w-6 text-center font-bold">${item.quantity}</span>
          <button type="button" class="increase rounded-lg bg-[#edf5e9] px-2 py-1 text-[#356a47]" aria-label="เพิ่มจำนวน">+</button>
        </div>
        <strong class="text-[#dd745c]">${formatBaht(item.unitPrice * item.quantity)}</strong>
      </div>`;

    row.querySelector(".remove-item").onclick = () => { cartState.items = cartState.items.filter(x => x.cartId !== item.cartId); renderCart(); };
    row.querySelector(".decrease").onclick = () => { item.quantity > 1 ? item.quantity-- : cartState.items = cartState.items.filter(x => x.cartId !== item.cartId); renderCart(); };
    row.querySelector(".increase").onclick = () => {
      const canIncrease = item.coinAmount
        ? coinsInCart() + item.coinAmount <= coinStock
        : item.quantity < item.stock;
      if (canIncrease) { item.quantity++; renderCart(); }
    };

    itemsEl.appendChild(row);
  });

  const count = cartState.items.reduce((sum, item) => sum + item.quantity, 0);
  const total = cartState.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  document.getElementById("cart-count").textContent = count;
  document.getElementById("cart-total").textContent = formatBaht(total);

  refreshCoinUI();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleCart(open) {
  document.getElementById("cart-drawer").classList.toggle("drawer-open", open);
  document.getElementById("cart-overlay").classList.toggle("overlay-show", open);
}

function showCheckoutMessage(message, error) {
  const el = document.getElementById("checkout-message");
  el.textContent = message;
  el.className = `mt-2 rounded-xl px-3 py-2 text-sm ${error ? "bg-[#fff1ed] text-[#ad5545]" : "bg-[#eaf7e6] text-[#356a47]"}`;
  el.classList.remove("hidden");
}

// ================= 6. ระบบส่งออเดอร์ + ตัดสต็อกเหรียญ =================
async function updateCoinStockInSheet(newStock) {
  const res = await fetch(`${SHEETDB_URL}/id/${COIN_STOCK_ROW_ID}?sheet=${COIN_STOCK_SHEET}`, {
    method: 'PATCH',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { stock_coins: newStock } })
  });
  if (!res.ok) throw new Error(`Update coin stock failed: ${res.status}`);
}

async function submitOrder(event) {
  event.preventDefault();

  const customerName = document.getElementById("customer-name").value.trim();
  const customerContact = document.getElementById("customer-contact").value.trim();

  if (!cartState.items.length) return showCheckoutMessage("กรุณาเพิ่มสินค้าลงตะกร้าก่อนส่งคำสั่งซื้อ", true);
  if (!customerName || !customerContact) return showCheckoutMessage("กรุณากรอกชื่อผู้สั่งและช่องทางติดต่อ", true);

  const submitBtn = document.querySelector("#checkout-form button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.textContent = "กำลังส่งคำสั่งซื้อ...";

  try {
    // ถ้ามีเหรียญในตะกร้า ดึงสต็อกล่าสุดจากชีตมาเช็กก่อน (กันคนอื่นซื้อไปก่อนแล้ว)
    const coinsToBuy = coinsInCart();
    let latestCoinStock = coinStock;
    if (coinsToBuy > 0) {
      latestCoinStock = await fetchCoinStock();
      if (latestCoinStock < coinsToBuy) {
        coinStock = latestCoinStock;
        refreshCoinUI();
        showCheckoutMessage(`เหรียญคงเหลือไม่พอ (เหลือ ${formatCoins(latestCoinStock)}) กรุณาปรับจำนวนในตะกร้า`, true);
        return;
      }
    }

    const ref = `HD-${Date.now().toString().slice(-6)}`;

    const orderSummary = cartState.items.map(item =>
      `[${item.name} / ${item.packLabel}] รายละเอียด: ${item.details} จำนวน: ${item.quantity} ${item.coinAmount ? 'ชุด' : 'ชิ้น'} (ราคารวม: ${item.unitPrice * item.quantity}฿)`
    ).join(" | ");

    const totalPrice = cartState.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const response = await fetch(`${SHEETDB_URL}?sheet=orders`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          ref: ref,
          name: customerName,
          contact: customerContact,
          order_details: orderSummary,
          total_price: totalPrice,
          status: "Pending"
        }
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(result));

    // ตัดสต็อกเหรียญกลาง (ทุก level ใช้สต็อกก้อนเดียวกัน)
    if (coinsToBuy > 0) {
      const newStock = latestCoinStock - coinsToBuy;
      try {
        await updateCoinStockInSheet(newStock);
      } catch (stockErr) {
        console.error("อัปเดตสต็อกเหรียญไม่สำเร็จ (ออเดอร์ถูกบันทึกแล้ว):", stockErr);
      }
      coinStock = newStock;
    }

    document.getElementById("order-reference").textContent = `เลขอ้างอิง ${ref}`;
    document.getElementById("confirmation-modal").classList.remove("hidden");
    document.getElementById("confirmation-modal").classList.add("flex");

    cartState.items = [];
    document.getElementById("checkout-form").reset();
    renderCart(); // จะรีเฟรชการ์ดเหรียญด้วย
    toggleCart(false);

  } catch (error) {
    console.error("Error submitting order:", error);
    showCheckoutMessage("เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง", true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "ส่งคำสั่งซื้อ";
  }
}

function closeConfirmation() {
  document.getElementById("confirmation-modal").classList.add("hidden");
  document.getElementById("confirmation-modal").classList.remove("flex");
}

// ================= เริ่มต้นการทำงาน =================
function initializeApp() {
  renderCart();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  loadDataFromSheetDB();
}

document.addEventListener("DOMContentLoaded", initializeApp);