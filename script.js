const SETS = {
  //These are the characters that can be used in the password generator.
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~",
};
const AMBIGUOUS = /[O0lI1|]/g;

const $ = (id) => document.getElementById(id);
const passwordEl = $("password");
const lengthEl = $("length");
const lengthValueEl = $("length-value");
const messageEl = $("message");
const strengthLabelEl = $("strength-label");
const meterEl = document.querySelector(".meter");
const toggleEl = $("toggle");

let currentPassword = ""; // the real password; the screen may show dots instead
let revealed = false;     // false = hidden (dots), true = visible

// Unbiased random integer in [0, max) using the browser's secure RNG.
function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

function buildPools(options) {
  const pools = [];
  for (const key of ["lower", "upper", "numbers", "symbols"]) {
    if (!options[key]) continue;
    const chars = options.skipAmbiguous ? SETS[key].replace(AMBIGUOUS, "") : SETS[key];
    pools.push(chars);
  }
  return pools;
}

// Returns a password string, or "" if no character types are selected.
function generatePassword(options) {
  const pools = buildPools(options);
  if (pools.length === 0) return "";

  const all = pools.join("");
  const chars = [];

  // Guarantee at least one character from every selected type.
  for (const pool of pools) chars.push(pool[randomInt(pool.length)]);
  while (chars.length < options.length) chars.push(all[randomInt(all.length)]);

  // Fisher–Yates shuffle so the guaranteed characters aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.slice(0, options.length).join("");
}

function estimateStrength(length, poolSize) {
  const bits = length * Math.log2(poolSize);
  if (bits < 40) return { level: 1, label: "Weak" };
  if (bits < 60) return { level: 2, label: "Fair" };
  if (bits < 90) return { level: 3, label: "Good" };
  return { level: 4, label: "Strong" };
}

function readOptions() {
  return {
    length: Number(lengthEl.value),
    lower: $("lower").checked,
    upper: $("upper").checked,
    numbers: $("numbers").checked,
    symbols: $("symbols").checked,
    skipAmbiguous: $("ambiguous").checked,
  };
}

function updateDisplay() {
  if (!currentPassword) return;
  passwordEl.textContent = revealed ? currentPassword : "\u2022".repeat(currentPassword.length);
}

function setRevealed(value) {
  revealed = value;
  toggleEl.setAttribute("aria-pressed", String(revealed));
  const label = revealed ? "Hide password" : "Show password";
  toggleEl.setAttribute("aria-label", label);
  toggleEl.title = label;
  toggleEl.querySelector(".icon-eye").hidden = revealed;
  toggleEl.querySelector(".icon-eye-off").hidden = !revealed;
  updateDisplay();
}

function render() {
  const options = readOptions();
  const pools = buildPools(options);

  if (pools.length === 0) {
    messageEl.textContent = "Select at least one character type.";
    currentPassword = "";
    passwordEl.textContent = "—";
    meterEl.dataset.level = "0";
    strengthLabelEl.textContent = "Strength appears here";
    return;
  }

  messageEl.textContent = "";
  currentPassword = generatePassword(options);
  updateDisplay();

  const poolSize = pools.join("").length;
  const { level, label } = estimateStrength(options.length, poolSize);
  meterEl.dataset.level = String(level);
  strengthLabelEl.textContent = `${label} · about ${Math.round(options.length * Math.log2(poolSize))} bits`;
}

async function copyPassword() {
  const text = currentPassword; // copy the real password even while it is hidden
  if (!text) return;
  const button = $("copy");
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy failed";
  }
  setTimeout(() => (button.textContent = "Copy"), 1500);
}

lengthEl.addEventListener("input", () => {
  lengthValueEl.textContent = lengthEl.value;
  render();
});
document.querySelectorAll("fieldset input").forEach((el) => el.addEventListener("change", render));
$("generate").addEventListener("click", render);
$("copy").addEventListener("click", copyPassword);
toggleEl.addEventListener("click", () => setRevealed(!revealed));

// Remove the welcome message from the page once its animation has finished.
const welcomeEl = $("welcome");
welcomeEl.addEventListener("animationend", () => welcomeEl.remove());

render();
