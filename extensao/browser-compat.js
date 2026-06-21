/* global browser, chrome */

const extensionApi = globalThis.browser || globalThis.chrome;

if (!extensionApi) {
  throw new Error("API de extensão indisponível neste navegador.");
}

function queryActiveTab() {
  const query = { active: true, currentWindow: true };

  if (extensionApi.tabs.query.length === 1) {
    return extensionApi.tabs.query(query);
  }

  return new Promise((resolve, reject) => {
    extensionApi.tabs.query(query, (tabs) => {
      const runtimeError = extensionApi.runtime.lastError;

      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      resolve(tabs);
    });
  });
}

function sendTabMessage(tabId, message) {
  if (extensionApi.tabs.sendMessage.length <= 2) {
    return extensionApi.tabs.sendMessage(tabId, message);
  }

  return new Promise((resolve, reject) => {
    extensionApi.tabs.sendMessage(tabId, message, (response) => {
      const runtimeError = extensionApi.runtime.lastError;

      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      resolve(response);
    });
  });
}

function executeScriptFile(tabId, file) {
  const details = {
    target: { tabId },
    files: [file]
  };

  if (extensionApi.scripting.executeScript.length === 1) {
    return extensionApi.scripting.executeScript(details);
  }

  return new Promise((resolve, reject) => {
    extensionApi.scripting.executeScript(details, (result) => {
      const runtimeError = extensionApi.runtime.lastError;

      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      resolve(result);
    });
  });
}

function createTab(url) {
  if (extensionApi.tabs.create.length === 1) {
    return extensionApi.tabs.create({ url });
  }

  return new Promise((resolve, reject) => {
    extensionApi.tabs.create({ url }, (tab) => {
      const runtimeError = extensionApi.runtime.lastError;

      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      resolve(tab);
    });
  });
}

function getExtensionUrl(path) {
  return extensionApi.runtime.getURL(path);
}
