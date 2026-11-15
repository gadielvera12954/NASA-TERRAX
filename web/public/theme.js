// Apply the saved appearance before the application and its styles load.
try {
  document.documentElement.dataset.theme =
    localStorage.getItem("terra-theme") === "light" ? "light" : "dark";
} catch {
  document.documentElement.dataset.theme = "dark";
}
