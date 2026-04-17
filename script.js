const initStrikerTracking = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const getCookie = (name) => {
    const escaped = encodeURIComponent(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(new RegExp("(^|; )" + escaped + "=([^;]*)"));
    return match ? decodeURIComponent(match[2]) : null;
  };

  const setCookie = (name, value, days = 365) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
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

  const getUserIp = async () => {
    try {
      let userIp = getCookie("user_ip");
      if (userIp) return userIp;
      const ipResponse = await fetch("https://api.ipify.org/?format=json");
      const ipData = await ipResponse.json();
      setCookie("user_ip", ipData.ip, 1);
      return ipData.ip;
    } catch {
      return null;
    }
  };

  const getUserId = () => {
    let userId = getCookie("striker_user_id");
    if (userId) return userId;
    userId = uuidv4();
    setCookie("striker_user_id", userId);
    return userId;
  };

  const triggerPageView = async () => {
    const dataLayerObj = {};
    dataLayerObj["event_id"] = uuidv4();
    dataLayerObj["user_ip"] = await getUserIp();
    dataLayerObj["external_id"] = getUserId();
    dataLayerObj["user_agent"] = navigator.userAgent;
    dataLayerObj["user_fbc"] = getCookie("_fbc") || (urlParams.get("fbclid") ? `fb.1.${Date.now()}.${urlParams.get("fbclid")}` : null);
    dataLayerObj["user_fbp"] = getCookie("_fbp");
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "striker_page_view",
      ...dataLayerObj,
    });
  };
  triggerPageView();

  document.addEventListener("submit", async (e) => {
    const form = e.target;
    const dataLayerObj = {};
    const userIp = getCookie("user_ip");
    if (userIp) dataLayerObj["user_ip"] = userIp;
    dataLayerObj["user_agent"] = navigator.userAgent;
    dataLayerObj["user_fbc"] = getCookie("_fbc") || (urlParams.get("fbclid") ? `fb.1.${Date.now()}.${urlParams.get("fbclid")}` : null);
    dataLayerObj["user_fbp"] = getCookie("_fbp");
    dataLayerObj["event_id"] = uuidv4();
    const emailElValue = form.querySelector("[type='email'],[name='email']")?.value;
    let firstNameElValue = form.querySelector("[name='first_name']")?.value;
    let lastNameElValue = form.querySelector("[name='last_name']")?.value;
    const fullNameElValue = form.querySelector("[name='full_name']")?.value;
    const nameToSplit = fullNameElValue || (!lastNameElValue ? firstNameElValue : null);
    if (nameToSplit) {
      const parts = nameToSplit.trim().split(/\s+/).filter(Boolean);
      firstNameElValue = parts[0];
      lastNameElValue = parts.slice(1).join(" ");
    }
    const phoneElValue = form.querySelector("[type='tel'],[name='phone_number'],[name='phone']")?.value;
    const zipElValue = form.querySelector("[name='zip'],[name='postal_code']")?.value;
    const cityElValue = form.querySelector("[name='city']")?.value;
    const stateElValue = form.querySelector("[name='state']")?.value;
    const countryElValue = form.querySelector("[name='country']")?.value;
    [
      { value: emailElValue, id: "email" },
      { value: firstNameElValue, id: "first_name" },
      { value: lastNameElValue, id: "last_name" },
      { value: phoneElValue, id: "phone" },
      { value: zipElValue, id: "zip" },
      { value: cityElValue, id: "city" },
      { value: stateElValue, id: "state" },
      { value: countryElValue, id: "country" },
    ].forEach((el) => {
      if (el.value) dataLayerObj[el.id] = el.value;
    });
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "striker_form_submit",
      ...dataLayerObj,
    });
  });
};
initStrikerTracking();
