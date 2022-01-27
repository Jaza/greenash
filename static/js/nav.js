ready(() => {
  document.getElementById("menu-icon").addEventListener("click", e => {
    document.querySelector("header").classList.toggle("expand");
    return false;
  });
});
