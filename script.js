const initStrikerTracking = () => {
  // A malformed cookie must not stop the events.
  const safeDecode = (v) => {
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };

  const getCookie = (name) => {
    const escaped = encodeURIComponent(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(new RegExp("(^|; )" + escaped + "=([^;]*)"));
    return match ? safeDecode(match[2]) : null;
  };

  // Highest domain that accepts a cookie (example.com, example.com.br), so subdomains share the cookies.
  const getRootDomain = () => {
    const host = window.location.hostname;
    if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":")) return "";
    const parts = host.split(".");
    for (let i = parts.length - 2; i >= 0; i--) {
      const candidate = parts.slice(i).join(".");
      document.cookie = `striker_domain_test=1; path=/; domain=${candidate}; SameSite=Lax`;
      if (document.cookie.includes("striker_domain_test=1")) {
        document.cookie = `striker_domain_test=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${candidate}`;
        return candidate;
      }
    }
    return "";
  };
  const ROOT_DOMAIN = getRootDomain();
  const domainAttr = ROOT_DOMAIN ? `; domain=${ROOT_DOMAIN}` : "";

  const setCookie = (name, value, days = 365) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/${domainAttr}; SameSite=Lax`;
  };

  // Removes both the root-domain cookie and a host-only one left by older versions.
  const deleteCookie = (name) => {
    const base = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    document.cookie = base;
    if (domainAttr) document.cookie = base + domainAttr;
  };

  const uuidv4 = () => {
    if (window.crypto && window.crypto.getRandomValues) {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = window.crypto.getRandomValues(new Uint8Array(1))[0] & 15;
        var v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const CLICK_IDS = [
    "gclid", "fbclid", "msclkid", "ttclid", "twclid", "dclid",
    "wbraid", "gbraid", "igshid", "gad_source", "gad_campaignid", "tbclid",
  ];

  const AD_SOURCE_MAP = [
    [["gclid", "gad_source", "gad_campaignid"], "google"],
    [["fbclid"], "facebook"],
    [["tbclid"], "taboola"],
    [["msclkid"], "bing"],
    [["ttclid"], "tiktok"],
  ];

  const isSafeParam = (key) => {
    const k = key.toLowerCase();
    return k.startsWith("utm_") || CLICK_IDS.includes(k);
  };

  // Click IDs are valid for 90 days at Meta and Google.
  const ATTRIBUTION_DAYS = 90;

  const getCurrentUrlParams = () => {
    const params = {};
    const urlParams = new URLSearchParams(window.location.search);
    for (const [key, value] of urlParams.entries()) {
      if (isSafeParam(key) && value) params[key] = value;
    }
    return params;
  };

  const getStoredParams = () => {
    const params = {};
    for (const cookie of document.cookie.split("; ")) {
      const [key, ...rest] = cookie.split("=");
      if (!key) continue;
      const decodedKey = safeDecode(key.trim());
      if (isSafeParam(decodedKey)) params[decodedKey] = safeDecode(rest.join("="));
    }
    return params;
  };

  // Last touch: a visit with new UTMs or click IDs replaces the whole stored set, so sources never mix.
  const saveUrlParams = () => {
    const current = getCurrentUrlParams();
    if (!Object.keys(current).length) return;
    Object.keys(getStoredParams()).forEach(deleteCookie);
    for (const [key, value] of Object.entries(current)) setCookie(key, value, ATTRIBUTION_DAYS);
  };

  const getUrlParams = () => ({ ...getStoredParams(), ...getCurrentUrlParams() });

  // fb.<subdomainIndex>.<creationTime>.<fbclid>, as in Meta's fbc guide. fbclid is case sensitive.
  const syncFbc = () => {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    if (!fbclid) return;
    const current = getCookie("_fbc");
    if (current && current.split(".").slice(3).join(".") === fbclid) return;
    const subdomainIndex = ROOT_DOMAIN ? ROOT_DOMAIN.split(".").length - 1 : 1;
    setCookie("_fbc", `fb.${subdomainIndex}.${Date.now()}.${fbclid}`, ATTRIBUTION_DAYS);
  };

  // Sent unhashed for the Conversions API.
  const getFbIds = () => {
    const ids = {};
    const fbc = getCookie("_fbc");
    const fbp = getCookie("_fbp");
    if (fbc) ids.fbc = fbc;
    if (fbp) ids.fbp = fbp;
    return ids;
  };

  const getAdSource = (params) => {
    for (const [keys, name] of AD_SOURCE_MAP) {
      if (keys.some((k) => params[k])) return name;
    }
    return "";
  };

  const getGaClientId = () => {
    const ga = getCookie("_ga");
    if (!ga) return "";
    const parts = ga.split(".");
    return parts.length >= 4 ? `${parts[2]}.${parts[3]}` : "";
  };

  const getAttributionData = () => {
    const params = getUrlParams();
    return {
      url_params: params,
      campaign: params["utm_campaign"] || params["gad_campaignid"] || "",
      keyword: params["utm_term"] || "",
      adSource: getAdSource(params),
      referrer: document.referrer,
      page: { url: window.location.href, title: document.title },
      domain: window.location.hostname,
      gaClientId: getGaClientId(),
      timestamp: Date.now(),
      ...getFbIds(),
    };
  };

  // Normalized to the format Meta expects; GTM hashes the values.
  const normEmail = (v) => (v || "").trim().toLowerCase();
  const normName = (v) =>
    (v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  const normDigits = (v) => (v || "").replace(/\D/g, "");

  // Keys are normName() output. Unknown names are dropped: Meta wants ISO 3166-1 alpha-2.
  const COUNTRY_MAP = {
    brasil: "br", brazil: "br", portugal: "pt",
    estadosunidos: "us", eua: "us", usa: "us", unitedstates: "us", unitedstatesofamerica: "us",
    argentina: "ar", mexico: "mx", chile: "cl", colombia: "co",
    uruguai: "uy", uruguay: "uy", paraguai: "py", paraguay: "py", peru: "pe",
    espanha: "es", spain: "es", espana: "es", canada: "ca",
    reinounido: "gb", uk: "gb", unitedkingdom: "gb", inglaterra: "gb", england: "gb",
  };
  const BR_STATES = {
    acre: "ac", alagoas: "al", amapa: "ap", amazonas: "am", bahia: "ba", ceara: "ce",
    distritofederal: "df", espiritosanto: "es", goias: "go", maranhao: "ma", matogrosso: "mt",
    matogrossodosul: "ms", minasgerais: "mg", para: "pa", paraiba: "pb", parana: "pr",
    pernambuco: "pe", piaui: "pi", riodejaneiro: "rj", riograndedonorte: "rn",
    riograndedosul: "rs", rondonia: "ro", roraima: "rr", santacatarina: "sc",
    saopaulo: "sp", sergipe: "se", tocantins: "to",
  };

  const normCountry = (v) => {
    const k = normName(v);
    return COUNTRY_MAP[k] || (k.length === 2 ? k : "");
  };
  const normState = (v, country) => {
    const k = normName(v);
    return (!country || country === "br") && BR_STATES[k] ? BR_STATES[k] : k;
  };
  const normZip = (v, country) => {
    const z = (v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return country === "us" ? z.slice(0, 5) : z;
  };

  // BR national number: DDD (two digits 1-9) + 8 digits, or + 9 digits starting with 9 (mobile).
  const isBrNational = (d) => /^[1-9]{2}\d{8}$/.test(d) || /^[1-9]{2}9\d{8}$/.test(d);
  // Digits only, country code included, no leading zeros.
  const normPhone = (v, country) => {
    const raw = (v || "").trim();
    if (/^(\+|00)/.test(raw)) return normDigits(raw).replace(/^0+/, "");
    const digits = normDigits(raw);
    let d = digits.replace(/^0+/, "");
    // 0 + carrier code + DDD + number (e.g. 0 21 11 98765-4321).
    if (digits.startsWith("0") && (d.length === 12 || d.length === 13) && isBrNational(d.slice(2))) d = d.slice(2);
    if ((!country || country === "br") && isBrNational(d)) d = "55" + d;
    return d;
  };

  const getUserId = () => {
    let userId = getCookie("striker_user_id");
    if (userId) return userId;
    userId = uuidv4();
    setCookie("striker_user_id", userId);
    return userId;
  };

  const triggerPageView = () => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "striker_page_view",
      event_id: uuidv4(),
      external_id: getUserId(),
      ...getAttributionData(),
    });
  };
  const identifyUmami = () => {
    if (!window.umami?.identify) return false;
    window.umami.identify(getUserId());
    return true;
  };
  // Umami may load after this script, also as an async script after "load". Poll for up to 10 s.
  const identifyUmamiWhenReady = () => {
    let tries = 0;
    const timer = setInterval(() => {
      if (identifyUmami() || ++tries >= 20) clearInterval(timer);
    }, 500);
  };

  saveUrlParams();
  syncFbc();
  triggerPageView();
  if (!identifyUmami()) {
    if (document.readyState === "complete") identifyUmamiWhenReady();
    else window.addEventListener("load", () => identifyUmami() || identifyUmamiWhenReady(), { once: true });
  }

  const triggerLead = (form, userId) => {
    const dataLayerObj = {};
    if (userId) dataLayerObj["user_id"] = userId;
    dataLayerObj["external_id"] = getUserId();
    dataLayerObj["event_id"] = uuidv4();
    const emailElValue = form.querySelector("[type='email'],[name='email'],[name='e-mail'],[name='e_mail']")?.value;
    let firstNameElValue = form.querySelector("[name='first_name'],[name='primeiro_nome'],[name='nome_primeiro']")?.value;
    let lastNameElValue = form.querySelector("[name='last_name'],[name='sobrenome'],[name='ultimo_nome']")?.value;
    const fullNameElValue = form.querySelector("[name='full_name'],[name='name'],[name='nome'],[name='nome_completo']")?.value;
    const nameToSplit = fullNameElValue || (!lastNameElValue ? firstNameElValue : null);
    if (nameToSplit) {
      const parts = nameToSplit.trim().split(/\s+/).filter(Boolean);
      firstNameElValue = parts[0];
      lastNameElValue = parts.slice(1).join(" ");
    }
    const phoneElValue = form.querySelector("[type='tel'],[name='phone_number'],[name='phone'],[name='telefone'],[name='celular'],[name='whatsapp'],[name='fone']")?.value;
    const zipElValue = form.querySelector("[name='zip'],[name='postal_code'],[name='cep']")?.value;
    const cityElValue = form.querySelector("[name='city'],[name='cidade'],[name='municipio']")?.value;
    const stateElValue = form.querySelector("[name='state'],[name='estado'],[name='uf']")?.value;
    const countryElValue = form.querySelector("[name='country'],[name='pais']")?.value;
    const country = normCountry(countryElValue);
    const normalized = {
      em: normEmail(emailElValue),
      ph: normPhone(phoneElValue, country),
      fn: normName(firstNameElValue),
      ln: normName(lastNameElValue),
      zp: normZip(zipElValue, country),
      ct: normName(cityElValue),
      st: normState(stateElValue, country),
      country,
      external_id: dataLayerObj["external_id"],
    };
    const userData = {};
    Object.entries(normalized).forEach(([key, value]) => {
      if (value) userData[key] = value;
    });
    Object.assign(dataLayerObj, getAttributionData());
    dataLayerObj["userData"] = userData;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "striker_form_submit",
      ...dataLayerObj,
    });
  };

  window.triggerStrikerLead = triggerLead;
};
initStrikerTracking();
