// ================= ตั้งค่า API =================
const SHEETDB_URL = 'https://sheetdb.io/api/v1/bhfhitw4gwpbt';

// ================= Global Coin Stock =================
// Stock จริงจะอ่านจาก row: coin-global-stock ใน sheet "coin"
const GLOBAL_COIN_STOCK_ID = "coin-global-stock";


// ================= ตั้งค่าชื่อหมวดหมู่และสี =================
const CATEGORY_NAMES = {
  "upgrade": "ไอเท็มอัปเกรด",
  "coin": "วนเหรียญ",
  "decor": "ของตกแต่ง"
};

const CATEGORY_COLORS = {
  "upgrade": {
    main: "#4d9b55",
    text: "#ffffff",
    hover: "#2f7640",
    light: "#eaf7e6",
    lightText: "#356a47"
  },
  "coin": {
    main: "#67b9db",
    text: "#ffffff",
    hover: "#477b91",
    light: "#eaf8fd",
    lightText: "#477b91"
  },
  "decor": {
    main: "#ffb9a5",
    text: "#6e3529",
    hover: "#d5765e",
    light: "#fff1ed",
    lightText: "#ad5545"
  },
  "default": {
    main: "#ffc944",
    text: "#594300",
    hover: "#d4a02c",
    light: "#fff0ad",
    lightText: "#76540c"
  }
};


// ================= ข้อมูลสินค้าและสถานะ =================
let allProducts = [];
let currentCategory = "";
let globalCoinStock = 0;

const appSettings = {
  music_url: ""
};

const cartState = {
  items: []
};

let musicAudio = null;


// ============================================================
// 1. ดึงข้อมูลจาก SheetDB
// ============================================================

async function loadDataFromSheetDB() {

  if (SHEETDB_URL === 'ใส่_URL_ของ_SHEETDB_ตรงนี้') {
    document.getElementById("loading-state").classList.add("hidden");
    document.getElementById("error-state").classList.remove("hidden");

    document.getElementById("error-state").innerHTML =
      "<p class='font-semibold text-[#ad5545]'>กรุณาใส่ URL ของ SheetDB ในไฟล์ script.js</p>";

    return;
  }

  try {

    const [stockResponse, coinResponse] = await Promise.all([
      fetch(SHEETDB_URL + '?sheet=Stock'),
      fetch(SHEETDB_URL + '?sheet=coin')
    ]);

    if (!stockResponse.ok || !coinResponse.ok) {
      throw new Error("ไม่สามารถโหลดข้อมูลจาก SheetDB ได้");
    }

    const stockData = await stockResponse.json();
    const coinData = await coinResponse.json();

    // --------------------------------------------------------
    // Global Coin Stock
    // --------------------------------------------------------

    const globalStockRow = Array.isArray(coinData)
      ? coinData.find(item => item.id === GLOBAL_COIN_STOCK_ID)
      : null;

    if (globalStockRow) {
      globalCoinStock = Number(globalStockRow.stock_quantity) || 0;
    } else {
      console.warn(
        `ไม่พบ ${GLOBAL_COIN_STOCK_ID} ใน sheet coin`
      );

      globalCoinStock = 0;
    }

    // --------------------------------------------------------
    // รวม Product
    // --------------------------------------------------------

    let rawData = [];

    if (!stockData.error) {
      rawData = rawData.concat(
        stockData.map(item => ({
          ...item,
          sheetName: 'Stock'
        }))
      );
    }

    if (!coinData.error) {
      rawData = rawData.concat(
        coinData
          .filter(item => item.id !== GLOBAL_COIN_STOCK_ID)
          .map(item => ({
            ...item,
            sheetName: 'coin'
          }))
      );
    }

    allProducts = rawData
      .map(item => ({
        ...item,

        price: Number(item.price) || 0,

        price_select:
          Number(item.price_select) || 0,

        price_pure:
          Number(item.price_pure) || 0,

        pack_amount:
          Number(item.pack_amount) || 89,

        stock_quantity:
          Number(item.stock_quantity) || 0,

        active:
          item.active === 'TRUE' ||
          item.active === 'true',

        items:
          item.items
            ? item.items
              .split(',')
              .map(i => i.trim())
              .filter(i => i !== '')
            : []
      }))
      .filter(product => product.active);

    renderDynamicCategories();

    document
      .getElementById("loading-state")
      .classList.add("hidden");

  } catch (error) {

    console.error(
      "Error fetching data:",
      error
    );

    document
      .getElementById("loading-state")
      .classList.add("hidden");

    document
      .getElementById("error-state")
      .classList.remove("hidden");
  }
}


// ============================================================
// 2. สร้าง Category Tabs
// ============================================================

function renderDynamicCategories() {

  const tabsContainer =
    document.getElementById("dynamic-tabs-container");

  const viewsContainer =
    document.getElementById("dynamic-views-container");

  tabsContainer.innerHTML = '';
  viewsContainer.innerHTML = '';

  const categories = [
    ...new Set(
      allProducts.map(p => p.category)
    )
  ];

  if (categories.length === 0) {

    document
      .getElementById("empty-state")
      .classList.remove("hidden");

    return;

  } else {

    document
      .getElementById("empty-state")
      .classList.add("hidden");
  }

  categories.forEach((cat, index) => {

    const displayName =
      CATEGORY_NAMES[cat] || cat;

    const tabBtn =
      document.createElement("button");

    tabBtn.type = "button";

    tabBtn.dataset.targetCat = cat;

    tabBtn.className =
      "canva-button flex-1 rounded-2xl px-5 py-3 font-bold whitespace-nowrap transition-all shadow-sm";

    tabBtn.textContent = displayName;

    tabBtn.onclick = () =>
      switchCategory(cat);

    tabsContainer.appendChild(tabBtn);


    const viewDiv =
      document.createElement("div");

    viewDiv.id = `view-${cat}`;

    viewDiv.className =
      index === 0
        ? "mt-7"
        : "hidden mt-7";


    const gridDiv =
      document.createElement("div");

    gridDiv.className =
      "grid grid-cols-1 gap-5 lg:grid-cols-3";


    viewDiv.appendChild(gridDiv);

    viewsContainer.appendChild(viewDiv);


    const productsInCat =
      allProducts.filter(
        p => p.category === cat
      );


    productsInCat.forEach(product => {

      if (
        product.items &&
        product.items.length > 0
      ) {

        renderPackProductCard(
          product,
          gridDiv
        );

      } else {

        renderSimpleProductCard(
          product,
          gridDiv
        );
      }

    });

  });


  if (categories.length > 0) {
    switchCategory(categories[0]);
  }
}


function switchCategory(category) {

  currentCategory = category;

  document
    .querySelectorAll(
      "#dynamic-tabs-container button"
    )
    .forEach(btn => {

      const cat =
        btn.dataset.targetCat;

      const theme =
        CATEGORY_COLORS[cat] ||
        CATEGORY_COLORS["default"];


      if (cat === category) {

        btn.style.backgroundColor =
          theme.main;

        btn.style.color =
          theme.text;

        btn.style.transform =
          "translateY(-2px)";

      } else {

        btn.style.backgroundColor =
          "#ffffff";

        btn.style.color =
          "#3c7067";

        btn.style.transform =
          "none";
      }

    });


  document
    .querySelectorAll(
      "#dynamic-views-container > div"
    )
    .forEach(view => {

      if (
        view.id === `view-${category}`
      ) {

        view.classList.remove("hidden");

      } else {

        view.classList.add("hidden");
      }

    });
}


// ============================================================
// 3. Upgrade Card
// ============================================================

function renderPackProductCard(product, container) {

  const fragment =
    document
      .getElementById("upgrade-card-template")
      .content
      .cloneNode(true);

  const card =
    fragment.querySelector("article");

  const theme =
    CATEGORY_COLORS[product.category] ||
    CATEGORY_COLORS["default"];


  card.dataset.productId =
    product.id;

  card.querySelector(
    ".upgrade-category"
  ).textContent =
    product.subcategory;

  card.querySelector(
    ".upgrade-name"
  ).textContent =
    product.name;


  setupImage(
    card.querySelector(
      ".product-image-wrap"
    ),
    product.image_url,
    product.name
  );


  const headerLine =
    card.querySelector("div.h-2");

  if (headerLine) {
    headerLine.style.backgroundColor =
      theme.main;
  }


  const badge =
    card.querySelector(".stock-badge");

  const available =
    isAvailable(product);


  badge.textContent =
    available
      ? "พร้อมขาย"
      : "สินค้าหมด";


  if (available) {

    badge.style.backgroundColor =
      theme.light;

    badge.style.color =
      theme.lightText;

  } else {

    badge.style.backgroundColor =
      "#ffe0d9";

    badge.style.color =
      "#a85242";
  }


  const choices =
    card.querySelector(".pack-choices");

  choices.innerHTML = "";


  const packTypes = [

    {
      key: "mixed",
      label: "แบบคละ",
      price: product.price
    },

    {
      key: "select",
      label: "แบบเลือก",
      price: product.price_select
    },

    {
      key: "pure",
      label: "แบบล้วน",
      price: product.price_pure
    }

  ];


  packTypes.forEach(pack => {

    if (pack.price > 0) {

      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "pack-choice rounded-xl border-2 px-1 py-2 text-xs font-bold transition";

      button.dataset.packKey =
        pack.key;

      button.textContent =
        `${pack.label} ${pack.price}฿`;

      button.addEventListener(
        "click",
        () =>
          selectPack(
            card,
            product,
            pack.key
          )
      );

      choices.appendChild(button);
    }

  });


  const addBtn =
    card.querySelector(".add-upgrade");

  addBtn.disabled =
    !available;

  addBtn.style.backgroundColor =
    available
      ? theme.main
      : "#a6b8a4";

  addBtn.style.color =
    available
      ? theme.text
      : "#ffffff";


  addBtn.onmouseenter = () => {

    if (available) {
      addBtn.style.backgroundColor =
        theme.hover;
    }

  };


  addBtn.onmouseleave = () => {

    if (available) {
      addBtn.style.backgroundColor =
        theme.main;
    }

  };


  addBtn.addEventListener(
    "click",
    () =>
      addUpgradeToCart(
        card,
        product
      )
  );


  container.appendChild(fragment);

  selectPack(
    container.lastElementChild,
    product,
    "mixed"
  );
}


function selectPack(
  card,
  product,
  packKey
) {

  const theme =
    CATEGORY_COLORS[product.category] ||
    CATEGORY_COLORS["default"];


  card.dataset.packKey =
    packKey;


  card
    .querySelectorAll(".pack-choice")
    .forEach(button => {

      if (
        button.dataset.packKey === packKey
      ) {

        button.style.borderColor =
          theme.main;

        button.style.backgroundColor =
          theme.light;

        button.style.color =
          theme.lightText;

      } else {

        button.style.borderColor =
          "#e2eadf";

        button.style.backgroundColor =
          "#ffffff";

        button.style.color =
          "#597260";
      }

    });


  const allocation =
    card.querySelector(".allocation");

  const mixNote =
    card.querySelector(".mix-note");


  mixNote.classList.add("hidden");

  allocation.classList.add("hidden");

  allocation.innerHTML = "";


  if (packKey === "mixed") {

    mixNote.classList.remove("hidden");

    setValidation(
      card,
      "",
      false
    );


  } else if (packKey === "select") {

    allocation.classList.remove(
      "hidden"
    );


    product.items.forEach(item => {

      const row =
        document.createElement("label");

      row.className =
        "mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-[#496555]";

      row.innerHTML =
        `<span>${item}</span>
        <input
          class="allocation-input qty-input w-20 rounded-xl border border-[#cfe0ca] px-2 py-1.5 text-center"
          type="number"
          min="0"
          max="${product.pack_amount}"
          step="1"
          value="0"
          data-item="${item}"
        >`;

      allocation.appendChild(row);

    });


    const total =
      document.createElement("p");

    total.className =
      "allocation-total mt-2 rounded-xl px-3 py-2 text-sm font-bold";

    allocation.appendChild(total);


    allocation
      .querySelectorAll(
        ".allocation-input"
      )
      .forEach(input =>
        input.addEventListener(
          "input",
          () =>
            validateAllocation(
              card,
              product,
              packKey
            )
        )
      );


    validateAllocation(
      card,
      product,
      packKey
    );


  } else if (packKey === "pure") {

    allocation.classList.remove(
      "hidden"
    );


    const title =
      document.createElement("p");

    title.className =
      "mb-2 text-sm font-bold text-[#496555]";

    title.textContent =
      `เลือกไอเท็มที่ต้องการ (ล้วน ${product.pack_amount} ชิ้น)`;

    allocation.appendChild(title);


    const selectBox =
      document.createElement("select");

    selectBox.className =
      "pure-select w-full rounded-xl border border-[#cfe0ca] px-3 py-2 text-sm font-semibold text-[#356a47]";


    product.items.forEach(item => {

      const option =
        document.createElement("option");

      option.value = item;

      option.textContent = item;

      selectBox.appendChild(option);

    });


    allocation.appendChild(selectBox);

    setValidation(
      card,
      "",
      false
    );
  }
}


function validateAllocation(
  card,
  product,
  packKey
) {

  if (packKey === "select") {

    const theme =
      CATEGORY_COLORS[product.category] ||
      CATEGORY_COLORS["default"];


    const inputs =
      [
        ...card.querySelectorAll(
          ".allocation-input"
        )
      ];


    const values =
      inputs.map(
        input => Number(input.value)
      );


    const invalid =
      values.some(
        value =>
          !Number.isInteger(value) ||
          value < 0
      );


    const total =
      values.reduce(
        (sum, value) =>
          sum +
          (
            Number.isFinite(value)
              ? value
              : 0
          ),
        0
      );


    const totalEl =
      card.querySelector(
        ".allocation-total"
      );


    if (totalEl) {

      totalEl.textContent =
        `รวม ${total}/${product.pack_amount} ชิ้น`;


      const valid =
        !invalid &&
        total === product.pack_amount;


      if (valid) {

        totalEl.style.backgroundColor =
          theme.light;

        totalEl.style.color =
          theme.lightText;

      } else {

        totalEl.style.backgroundColor =
          "#fff1ed";

        totalEl.style.color =
          "#ad5545";
      }


      setValidation(
        card,
        valid
          ? ""
          : `กรุณาระบุจำนวนให้ครบ ${product.pack_amount} ชิ้น`,
        !valid
      );


      return valid;
    }
  }

  return true;
}


// ============================================================
// 4. เพิ่ม Upgrade ลง Cart
// ============================================================

function addUpgradeToCart(
  card,
  product
) {

  const packKey =
    card.dataset.packKey ||
    "mixed";


  if (!isAvailable(product)) {

    return setValidation(
      card,
      "สินค้านี้ยังไม่มีสต็อกสำหรับเพิ่มลงตะกร้า",
      true
    );
  }


  let details =
    "ร้านค้าจะคละสินค้าให้";

  let packLabel =
    "แบบคละ";

  let packPrice =
    product.price;


  if (packKey === "select") {

    if (
      !validateAllocation(
        card,
        product,
        packKey
      )
    ) return;


    const inputs =
      [
        ...card.querySelectorAll(
          ".allocation-input"
        )
      ];


    details =
      inputs
        .map(
          input =>
            `${input.dataset.item} ${input.value} ชิ้น`
        )
        .filter(
          text =>
            !text.includes(
              " 0 ชิ้น"
            )
        )
        .join(" • ");


    packLabel =
      "แบบเลือก";

    packPrice =
      product.price_select;


  } else if (packKey === "pure") {

    const selectedItem =
      card.querySelector(
        ".pure-select"
      ).value;


    details =
      `${selectedItem} ล้วน ${product.pack_amount} ชิ้น`;

    packLabel =
      "แบบล้วน";

    packPrice =
      product.price_pure;
  }


  const cartId =
    `${product.id}-${packKey}-${details}`;


  addCartItem({

    cartId,

    productId:
      product.id,

    name:
      product.name,

    group:
      product.subcategory,

    packLabel,

    details,

    unitPrice:
      packPrice,

    stock:
      product.stock_quantity,

    sheetName:
      product.sheetName,

    category:
      product.category

  });


  setValidation(
    card,
    "เพิ่มลงตะกร้าแล้ว 🌻",
    false
  );
}


// ============================================================
// 5. Coin Card
// ============================================================

function renderSimpleProductCard(
  product,
  container
) {

  const fragment =
    document
      .getElementById(
        "coin-card-template"
      )
      .content
      .cloneNode(true);


  const card =
    fragment.querySelector(
      "article"
    );


  const theme =
    CATEGORY_COLORS[product.category] ||
    CATEGORY_COLORS["default"];


  card.querySelector(
    ".coin-level"
  ).textContent =
    product.subcategory ||
    product.category;


  card.querySelector(
    ".coin-name"
  ).textContent =
    product.name;


  card.querySelector(
    ".coin-price"
  ).textContent =
    formatBaht(product.price);


  // ----------------------------------------------------------
  // Coin ใช้ Global Stock
  // ----------------------------------------------------------

  if (product.category === "coin") {

    card.querySelector(
      ".coin-stock"
    ).textContent =
      `🪙 เหรียญคงเหลือ: ${globalCoinStock.toLocaleString("th-TH")}`;

  } else {

    card.querySelector(
      ".coin-stock"
    ).textContent =
      `สต็อกคงเหลือ: ${stockText(product.stock_quantity)}`;
  }


  setupImage(
    card.querySelector(
      ".product-image-wrap"
    ),
    product.image_url,
    product.name
  );


  const headerLine =
    card.querySelector("div.h-2");

  if (headerLine) {
    headerLine.style.backgroundColor =
      theme.main;
  }


  const badge =
    card.querySelector(
      ".stock-badge"
    );


  const available =
    product.category === "coin"
      ? globalCoinStock > 0
      : isAvailable(product);


  badge.textContent =
    available
      ? "พร้อมขาย"
      : "สินค้าหมด";


  if (available) {

    badge.style.backgroundColor =
      theme.light;

    badge.style.color =
      theme.lightText;

  } else {

    badge.style.backgroundColor =
      "#ffe0d9";

    badge.style.color =
      "#a85242";
  }


  const addBtn =
    card.querySelector(
      ".add-coin"
    );


  addBtn.disabled =
    !available;


  addBtn.style.backgroundColor =
    available
      ? theme.main
      : "#a6b8a4";


  addBtn.style.color =
    available
      ? theme.text
      : "#ffffff";


  addBtn.onmouseenter = () => {

    if (available) {
      addBtn.style.backgroundColor =
        theme.hover;
    }

  };


  addBtn.onmouseleave = () => {

    if (available) {
      addBtn.style.backgroundColor =
        theme.main;
    }

  };


  addBtn.addEventListener(
    "click",
    () => {

      addCartItem({

        cartId:
          product.id,

        productId:
          product.id,

        name:
          product.name,

        group:
          product.subcategory,

        packLabel:
          product.amount
            ? `จำนวน ${product.amount}`
            : `1 ชิ้น`,

        details:
          product.amount
            ? `รายละเอียด: ${product.amount}`
            : "สินค้าจำนวน 1 ชุด",

        unitPrice:
          product.price,

        stock:
          product.stock_quantity,

        sheetName:
          product.sheetName,

        category:
          product.category

      });

    }
  );


  container.appendChild(
    fragment
  );
}


// ============================================================
// 6. ฟังก์ชันช่วยเหลือ
// ============================================================

function formatBaht(value) {
  return `${Number(value).toLocaleString("th-TH")} บาท`;
}


function stockText(stock) {

  return stock === null ||
    isNaN(stock)

    ? "ยังไม่ระบุ"

    : `${stock} ชุด`;
}


function isAvailable(product) {

  return (
    product.active &&
    Number(product.stock_quantity) > 0
  );
}


// ============================================================
// จำนวนเหรียญของสินค้า
// ============================================================

function getCoinAmount(product) {

  if (
    product.category !== "coin"
  ) {
    return 0;
  }


  const match =
    String(product.name).match(
      /(\d+(?:\.\d+)?)\s*(แสน|ล้าน)/
    );


  if (!match) {
    return 0;
  }


  const value =
    Number(match[1]);

  const unit =
    match[2];


  if (unit === "แสน") {
    return value * 100000;
  }


  if (unit === "ล้าน") {
    return value * 1000000;
  }


  return 0;
}


// ============================================================
// จำนวน Coin ที่อยู่ใน Cart
// ============================================================

function getCoinInCart() {

  return cartState.items.reduce(
    (total, item) => {

      if (
        item.category !== "coin"
      ) {
        return total;
      }


      return total +
        (
          getCoinAmount(item) *
          item.quantity
        );

    },
    0
  );
}


// ============================================================
// โหลด Global Coin Stock ใหม่จาก SheetDB
// ============================================================

async function refreshGlobalCoinStock() {

  try {

    const response =
      await fetch(
        `${SHEETDB_URL}/id/${encodeURIComponent(GLOBAL_COIN_STOCK_ID)}?sheet=coin`
      );


    if (!response.ok) {
      throw new Error(
        "ไม่สามารถอ่าน Global Coin Stock"
      );
    }


    const data =
      await response.json();


    const row =
      Array.isArray(data)
        ? data[0]
        : data;


    if (!row) {
      throw new Error(
        "ไม่พบ Global Coin Stock"
      );
    }


    globalCoinStock =
      Number(
        row.stock_quantity
      ) || 0;


    updateCoinStockDisplay();


    return globalCoinStock;

  } catch (error) {

    console.error(
      "refreshGlobalCoinStock:",
      error
    );

    throw error;
  }
}


// ============================================================
// อัปเดต Stock ที่แสดงบนทุก Coin Card
// ============================================================

function updateCoinStockDisplay() {

  document
    .querySelectorAll(
      ".coin-stock"
    )
    .forEach(el => {

      el.textContent =
        `🪙 เหรียญคงเหลือ: ${globalCoinStock.toLocaleString("th-TH")}`;

    });


  document
    .querySelectorAll(
      "#view-coin .stock-badge"
    )
    .forEach(badge => {

      const available =
        globalCoinStock > 0;


      badge.textContent =
        available
          ? "พร้อมขาย"
          : "สินค้าหมด";

    });


  document
    .querySelectorAll(
      "#view-coin .add-coin"
    )
    .forEach(button => {

      const available =
        globalCoinStock > 0;


      button.disabled =
        !available;

    });
}


// ============================================================
// ตรวจว่า Coin ใน Cart ยังไม่เกิน Global Stock
// ============================================================

function canAddCoinToCart(
  newItem
) {

  const coinAmount =
    getCoinAmount(newItem);


  if (coinAmount <= 0) {

    showToast(
      "❌ ไม่สามารถอ่านจำนวนเหรียญของสินค้าได้"
    );

    return false;
  }


  const currentCoin =
    getCoinInCart();


  if (
    currentCoin +
    coinAmount >
    globalCoinStock
  ) {

    const remaining =
      Math.max(
        0,
        globalCoinStock -
        currentCoin
      );


    showToast(
      `❌ เหรียญไม่พอ เหลือ ${remaining.toLocaleString("th-TH")} เหรียญ`
    );


    return false;
  }


  return true;
}


// ============================================================
// Toast
// ============================================================

function showToast(message) {

  const toast =
    document.createElement(
      "div"
    );


  toast.className = `
    fixed
    bottom-5
    left-4
    right-4
    sm:left-auto
    sm:right-6
    sm:bottom-6
    z-[9999]

    bg-gray-900
    text-white

    px-4
    py-3
    sm:px-5
    sm:py-3

    rounded-xl
    shadow-lg

    text-sm
    sm:text-base

    text-center
    sm:text-left

    opacity-0
    translate-y-4
    sm:translate-y-0
    sm:translate-x-10

    transition-all
    duration-300
    ease-out

    max-w-md
    mx-auto
    sm:mx-0
  `;


  toast.textContent =
    message;


  document.body.appendChild(
    toast
  );


  requestAnimationFrame(() => {

    toast.classList.remove(
      "opacity-0",
      "translate-y-4",
      "sm:translate-x-10"
    );

  });


  setTimeout(() => {

    toast.classList.add(
      "opacity-0",
      "translate-y-4"
    );


    setTimeout(() => {

      toast.remove();

    }, 300);

  }, 2200);
}


// ============================================================
// Image
// ============================================================

function setupImage(
  wrapper,
  imageUrl,
  label
) {

  const img =
    wrapper.querySelector(
      ".product-image"
    );

  const placeholder =
    wrapper.querySelector(
      ".image-placeholder"
    );


  if (
    imageUrl &&
    String(imageUrl).trim()
  ) {

    img.src =
      imageUrl;

    img.alt =
      label;

    img.classList.remove(
      "hidden"
    );

    placeholder.classList.add(
      "hidden"
    );
  }
}


function setValidation(
  card,
  message,
  isError
) {

  const messageEl =
    card.querySelector(
      ".validation-message"
    );


  if (!messageEl) {
    return;
  }


  messageEl.textContent =
    message;


  messageEl.classList.toggle(
    "hidden",
    !message
  );


  messageEl.className =
    `validation-message mt-3 rounded-xl px-3 py-2 text-sm ${message
      ? (
        isError
          ? "bg-[#fff1ed] text-[#ad5545]"
          : "bg-[#eaf7e6] text-[#356a47]"
      )
      : "hidden"
    }`;
}


// ============================================================
// 7. ระบบ Cart
// ============================================================

function addCartItem(
  newItem
) {

  // ----------------------------------------------------------
  // Coin Global Stock
  // ----------------------------------------------------------

  if (
    newItem.category === "coin"
  ) {

    if (
      !canAddCoinToCart(
        newItem
      )
    ) {
      return;
    }

  }


  const existing =
    cartState.items.find(
      item =>
        item.cartId ===
        newItem.cartId
    );


  if (existing) {

    // --------------------------------------------------------
    // Coin
    // --------------------------------------------------------

    if (
      newItem.category === "coin"
    ) {

      const coinAmount =
        getCoinAmount(
          newItem
        );


      if (
        getCoinInCart() +
        coinAmount >
        globalCoinStock
      ) {

        showToast(
          "❌ เหรียญในสต็อกไม่เพียงพอ"
        );

        return;
      }

    }


    // --------------------------------------------------------
    // สินค้าปกติ
    // --------------------------------------------------------

    if (
      newItem.category !== "coin" &&
      existing.quantity >=
      newItem.stock
    ) {

      showToast(
        "❌ สินค้าหมด"
      );

      return;
    }


    existing.quantity += 1;


  } else {

    cartState.items.push({
      ...newItem,
      quantity: 1
    });

  }


  renderCart();

  showToast(
    "🛒 เพิ่มลงตะกร้าแล้ว"
  );
}


// ============================================================
// Render Cart
// ============================================================

function renderCart() {

  const itemsEl =
    document.getElementById(
      "cart-items"
    );


  itemsEl.replaceChildren();


  const empty =
    cartState.items.length === 0;


  document
    .getElementById("cart-empty")
    .classList.toggle(
      "hidden",
      !empty
    );


  itemsEl.classList.toggle(
    "hidden",
    empty
  );


  cartState.items.forEach(
    item => {

      const row =
        document.createElement(
          "article"
        );


      row.className =
        "mb-3 rounded-2xl border border-[#e1ebdd] bg-white p-3";


      row.innerHTML = `
        <div class="flex justify-between gap-3">

          <div>

            <h3 class="font-bold text-[#356a47]">
              ${item.name}
            </h3>

            <p class="text-xs text-[#687e70]">
              ${item.group} · ${item.packLabel}
            </p>

          </div>

          <button
            type="button"
            class="remove-item rounded-lg p-1 text-[#c86656]"
            aria-label="ลบสินค้า"
          >
            <i
              data-lucide="trash-2"
              class="w-4 h-4"
            ></i>
          </button>

        </div>


        <p class="mt-2 text-xs text-[#718276]">
          ${item.details}
        </p>


        <div class="mt-3 flex items-center justify-between">

          <div class="flex items-center gap-2">

            <button
              type="button"
              class="decrease rounded-lg bg-[#edf5e9] px-2 py-1 text-[#356a47]"
              aria-label="ลดจำนวน"
            >
              −
            </button>


            <span class="min-w-6 text-center font-bold">
              ${item.quantity}
            </span>


            <button
              type="button"
              class="increase rounded-lg bg-[#edf5e9] px-2 py-1 text-[#356a47]"
              aria-label="เพิ่มจำนวน"
            >
              +
            </button>

          </div>


          <strong class="text-[#dd745c]">
            ${formatBaht(
        item.unitPrice *
        item.quantity
      )}
          </strong>

        </div>
      `;


      // --------------------------------------------------------
      // Remove
      // --------------------------------------------------------

      row
        .querySelector(
          ".remove-item"
        )
        .onclick = () => {

          cartState.items =
            cartState.items.filter(
              x =>
                x.cartId !==
                item.cartId
            );

          renderCart();
        };


      // --------------------------------------------------------
      // Decrease
      // --------------------------------------------------------

      row
        .querySelector(
          ".decrease"
        )
        .onclick = () => {

          if (
            item.quantity > 1
          ) {

            item.quantity--;

          } else {

            cartState.items =
              cartState.items.filter(
                x =>
                  x.cartId !==
                  item.cartId
              );
          }


          renderCart();
        };


      // --------------------------------------------------------
      // Increase
      // --------------------------------------------------------

      row
        .querySelector(
          ".increase"
        )
        .onclick = () => {

          // Coin
          if (
            item.category === "coin"
          ) {

            const coinAmount =
              getCoinAmount(
                item
              );


            if (
              getCoinInCart() +
              coinAmount >
              globalCoinStock
            ) {

              showToast(
                "❌ เหรียญในสต็อกไม่เพียงพอ"
              );

              return;
            }


            item.quantity++;

            renderCart();

            return;
          }


          // Normal Product
          if (
            item.quantity <
            item.stock
          ) {

            item.quantity++;

            renderCart();
          }

        };


      itemsEl.appendChild(
        row
      );

    }
  );


  const count =
    cartState.items.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    );


  const total =
    cartState.items.reduce(
      (sum, item) =>
        sum +
        (
          item.quantity *
          item.unitPrice
        ),
      0
    );


  document
    .getElementById(
      "cart-count"
    )
    .textContent =
    count;


  document
    .getElementById(
      "cart-total"
    )
    .textContent =
    formatBaht(total);


  if (
    typeof lucide !==
    'undefined'
  ) {

    lucide.createIcons();
  }
}


// ============================================================
// Cart Drawer
// ============================================================

function toggleCart(open) {

  document
    .getElementById(
      "cart-drawer"
    )
    .classList.toggle(
      "drawer-open",
      open
    );


  document
    .getElementById(
      "cart-overlay"
    )
    .classList.toggle(
      "overlay-show",
      open
    );
}


function showCheckoutMessage(
  message,
  error
) {

  const el =
    document.getElementById(
      "checkout-message"
    );


  el.textContent =
    message;


  el.className =
    `mt-2 rounded-xl px-3 py-2 text-sm ${error
      ? "bg-[#fff1ed] text-[#ad5545]"
      : "bg-[#eaf7e6] text-[#356a47]"
    }`;


  el.classList.remove(
    "hidden"
  );
}


// ============================================================
// 8. หัก Global Coin Stock จาก SheetDB
// ============================================================

async function deductGlobalCoinStock(
  amount
) {

  if (amount <= 0) {
    return true;
  }


  // ----------------------------------------------------------
  // อ่าน Stock ล่าสุดจาก SheetDB ก่อนหัก
  // ----------------------------------------------------------

  const response =
    await fetch(
      `${SHEETDB_URL}/id/${encodeURIComponent(GLOBAL_COIN_STOCK_ID)}?sheet=coin`
    );


  if (!response.ok) {

    throw new Error(
      "ไม่สามารถอ่าน Coin Stock ล่าสุดได้"
    );
  }


  const data =
    await response.json();


  const row =
    Array.isArray(data)
      ? data[0]
      : data;


  if (!row) {

    throw new Error(
      "ไม่พบ Global Coin Stock"
    );
  }


  const latestStock =
    Number(
      row.stock_quantity
    ) || 0;


  // ----------------------------------------------------------
  // ตรวจ Stock ล่าสุด
  // ----------------------------------------------------------

  if (
    latestStock < amount
  ) {

    throw new Error(
      `COIN_STOCK_NOT_ENOUGH:${latestStock}`
    );
  }


  const newStock =
    latestStock -
    amount;


  // ----------------------------------------------------------
  // PATCH SheetDB
  // ----------------------------------------------------------

  const updateResponse =
    await fetch(
      `${SHEETDB_URL}/id/${encodeURIComponent(GLOBAL_COIN_STOCK_ID)}?sheet=coin`,
      {
        method: "PATCH",

        headers: {
          "Accept":
            "application/json",

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            data: {
              stock_quantity:
                newStock
            }
          })
      }
    );


  if (
    !updateResponse.ok
  ) {

    let errorData = null;

    try {
      errorData =
        await updateResponse.json();
    } catch (_) { }


    console.error(
      "SheetDB stock update error:",
      errorData
    );


    throw new Error(
      "ไม่สามารถหัก Coin Stock ได้"
    );
  }


  const result =
    await updateResponse.json();


  console.log(
    "Global Coin Stock updated:",
    result
  );


  // ----------------------------------------------------------
  // Update local state
  // ----------------------------------------------------------

  globalCoinStock =
    newStock;


  updateCoinStockDisplay();


  return true;
}


// ============================================================
// 9. ส่ง Order
// ============================================================

async function submitOrder(
  event
) {

  event.preventDefault();


  const customerName =
    document
      .getElementById(
        "customer-name"
      )
      .value
      .trim();


  const customerContact =
    document
      .getElementById(
        "customer-contact"
      )
      .value
      .trim();


  if (
    !cartState.items.length
  ) {

    return showCheckoutMessage(
      "กรุณาเพิ่มสินค้าลงตะกร้าก่อนส่งคำสั่งซื้อ",
      true
    );
  }


  if (
    !customerName ||
    !customerContact
  ) {

    return showCheckoutMessage(
      "กรุณากรอกชื่อผู้สั่งและช่องทางติดต่อ",
      true
    );
  }


  const submitBtn =
    document.querySelector(
      "#checkout-form button[type='submit']"
    );


  submitBtn.disabled =
    true;

  submitBtn.textContent =
    "กำลังตรวจสอบสต็อก...";


  try {

    // --------------------------------------------------------
    // Snapshot Cart
    // --------------------------------------------------------

    const orderItems =
      cartState.items.map(
        item => ({
          ...item
        })
      );


    // --------------------------------------------------------
    // คำนวณ Coin ทั้ง Order
    // --------------------------------------------------------

    const coinAmount =
      orderItems.reduce(
        (total, item) => {

          if (
            item.category !==
            "coin"
          ) {
            return total;
          }


          return total +
            (
              getCoinAmount(item) *
              item.quantity
            );

        },
        0
      );


    // --------------------------------------------------------
    // ถ้ามี Coin ให้เช็ก Stock ล่าสุดจาก SheetDB
    // --------------------------------------------------------

    if (coinAmount > 0) {

      submitBtn.textContent =
        "กำลังตรวจสอบเหรียญ...";


      await refreshGlobalCoinStock();


      if (
        coinAmount >
        globalCoinStock
      ) {

        throw new Error(
          `COIN_STOCK_NOT_ENOUGH:${globalCoinStock}`
        );
      }

    }


    // --------------------------------------------------------
    // สร้าง Reference
    // --------------------------------------------------------

    const ref =
      `HD-${Date.now()
        .toString()
        .slice(-6)}`;


    // --------------------------------------------------------
    // Order Summary
    // --------------------------------------------------------

    const orderSummary =
      orderItems
        .map(
          item =>
            `[${item.name} / ${item.packLabel}] รายละเอียด: ${item.details} จำนวน: ${item.quantity} ชิ้น (ราคารวม: ${item.unitPrice * item.quantity}฿)`
        )
        .join(" | ");


    const totalPrice =
      orderItems.reduce(
        (sum, item) =>
          sum +
          (
            item.quantity *
            item.unitPrice
          ),
        0
      );


    // --------------------------------------------------------
    // 1. ส่ง Order เข้า SheetDB
    // --------------------------------------------------------

    submitBtn.textContent =
      "กำลังส่งคำสั่งซื้อ...";


    const response =
      await fetch(
        `${SHEETDB_URL}?sheet=orders`,
        {

          method:
            'POST',

          headers: {

            'Accept':
              'application/json',

            'Content-Type':
              'application/json'

          },

          body:
            JSON.stringify({

              data: {

                ref:
                  ref,

                name:
                  customerName,

                contact:
                  customerContact,

                order_details:
                  orderSummary,

                total_price:
                  totalPrice,

                status:
                  "Pending"

              }

            })

        }
      );


    if (
      !response.ok
    ) {

      let errorData = null;

      try {

        errorData =
          await response.json();

      } catch (_) { }


      console.error(
        "Order SheetDB error:",
        errorData
      );


      throw new Error(
        "ไม่สามารถบันทึก Order ได้"
      );
    }


    // --------------------------------------------------------
    // 2. หัก Coin Stock
    // --------------------------------------------------------

    if (coinAmount > 0) {

      submitBtn.textContent =
        "กำลังอัปเดตสต็อกเหรียญ...";


      try {

        await deductGlobalCoinStock(
          coinAmount
        );

      } catch (stockError) {

        console.error(
          "Coin stock deduction failed:",
          stockError
        );


        // ----------------------------------------------------
        // สำคัญ:
        // Order ถูกสร้างไปแล้ว แต่หัก stock ไม่สำเร็จ
        // ----------------------------------------------------

        throw new Error(
          "ORDER_CREATED_BUT_STOCK_UPDATE_FAILED"
        );
      }

    }


    // --------------------------------------------------------
    // Order สำเร็จ
    // --------------------------------------------------------

    document
      .getElementById(
        "order-reference"
      )
      .textContent =
      `เลขอ้างอิง ${ref}`;


    document
      .getElementById(
        "confirmation-modal"
      )
      .classList.remove(
        "hidden"
      );


    document
      .getElementById(
        "confirmation-modal"
      )
      .classList.add(
        "flex"
      );


    cartState.items =
      [];


    document
      .getElementById(
        "checkout-form"
      )
      .reset();


    renderCart();


    toggleCart(
      false
    );


  } catch (error) {

    console.error(
      "Error submitting order:",
      error
    );


    // --------------------------------------------------------
    // Coin หมด / ไม่พอ
    // --------------------------------------------------------

    if (
      String(error.message)
        .startsWith(
          "COIN_STOCK_NOT_ENOUGH:"
        )
    ) {

      const stock =
        Number(
          String(error.message)
            .split(":")[1]
        ) || 0;


      showCheckoutMessage(
        `เหรียญไม่พอ สต็อกปัจจุบันเหลือ ${stock.toLocaleString("th-TH")} เหรียญ`,
        true
      );


      await refreshGlobalCoinStock()
        .catch(() => { });


      return;
    }


    // --------------------------------------------------------
    // Order ถูกสร้างแล้ว แต่ Stock Update fail
    // --------------------------------------------------------

    if (
      error.message ===
      "ORDER_CREATED_BUT_STOCK_UPDATE_FAILED"
    ) {

      showCheckoutMessage(
        "บันทึกคำสั่งซื้อแล้ว แต่ระบบอัปเดตสต็อกเหรียญไม่สำเร็จ กรุณาติดต่อร้านก่อนส่ง Order ซ้ำ",
        true
      );


      return;
    }


    // --------------------------------------------------------
    // Error ทั่วไป
    // --------------------------------------------------------

    showCheckoutMessage(
      "เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง",
      true
    );


  } finally {

    submitBtn.disabled =
      false;

    submitBtn.textContent =
      "ส่งคำสั่งซื้อ";

  }
}


// ============================================================
// 10. Confirmation
// ============================================================

function closeConfirmation() {

  document
    .getElementById(
      "confirmation-modal"
    )
    .classList.add(
      "hidden"
    );


  document
    .getElementById(
      "confirmation-modal"
    )
    .classList.remove(
      "flex"
    );
}


// ============================================================
// 11. เริ่มต้น App
// ============================================================

function initializeApp() {

  renderCart();


  if (
    typeof lucide !==
    'undefined'
  ) {

    lucide.createIcons();

  }


  loadDataFromSheetDB();

}


document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);

