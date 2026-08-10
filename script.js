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

  const getUserGeo = async () => {
    try {
      const cached = {
        user_ip: getCookie("user_ip"),
        zip: getCookie("user_ip_zip"),
        city: getCookie("user_ip_city"),
        state: getCookie("user_ip_state"),
        country: getCookie("user_ip_country"),
      };
      if (cached.user_ip) return cached;
      const res = await fetch("https://free.freeipapi.com/api/json");
      const data = await res.json();
      const geo = {
        user_ip: data.ipAddress,
        zip: cached.zip || data.zipCode,
        city: cached.city || data.cityName,
        state: cached.state || data.regionName,
        country: cached.country || data.countryName,
      };
      if (geo.user_ip) setCookie("user_ip", geo.user_ip, 1);
      if (geo.zip) setCookie("user_ip_zip", geo.zip);
      if (geo.city) setCookie("user_ip_city", geo.city);
      if (geo.state) setCookie("user_ip_state", geo.state);
      if (geo.country) setCookie("user_ip_country", geo.country);
      return geo;
    } catch {
      return {};
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
    const geo = await getUserGeo();
    if (geo.user_ip) dataLayerObj["user_ip"] = geo.user_ip;
    if (geo.zip) dataLayerObj["zip"] = geo.zip;
    if (geo.city) dataLayerObj["city"] = geo.city;
    if (geo.state) dataLayerObj["state"] = geo.state;
    if (geo.country) dataLayerObj["country"] = geo.country;
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

  const triggerLead = async (form) => {
    const dataLayerObj = {};
    const userIp = getCookie("user_ip");
    if (userIp) dataLayerObj["user_ip"] = userIp;
    dataLayerObj["external_id"] = getUserId();
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
    const zipFormValue = form.querySelector("[name='zip'],[name='postal_code']")?.value;
    const cityFormValue = form.querySelector("[name='city']")?.value;
    const stateFormValue = form.querySelector("[name='state']")?.value;
    const countryFormValue = form.querySelector("[name='country']")?.value;

    if (zipFormValue) setCookie("user_ip_zip", zipFormValue);
    if (cityFormValue) setCookie("user_ip_city", cityFormValue);
    if (stateFormValue) setCookie("user_ip_state", stateFormValue);
    if (countryFormValue) setCookie("user_ip_country", countryFormValue);

    const phoneElValue = form.querySelector("[type='tel'],[name='phone_number'],[name='phone']")?.value;
    const zipElValue = zipFormValue || getCookie("user_ip_zip");
    const cityElValue = cityFormValue || getCookie("user_ip_city");
    const stateElValue = stateFormValue || getCookie("user_ip_state");
    const countryElValue = countryFormValue || getCookie("user_ip_country");
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
  };

  window.triggerStrikerLead = triggerLead;
};
initStrikerTracking();
