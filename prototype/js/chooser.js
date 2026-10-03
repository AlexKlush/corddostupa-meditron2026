/* Экран выбора роли. Стол включается мерцанием лампы, на нём висят две плёнки:
   «Кабинет пациента» и «Кабинет клиники». Клик раскрывает плёнку в кабинет. */
(function () {
  "use strict";
  const { $, $$, esc, icon } = U;
  const D = DATA;

  function html() {
    const lit = Store.all().filter(p => p.lit).length;
    const urgent = Store.all().filter(p => p.lit && p.priority === "urgent").length;
    const p = Store.patient("p01");
    const nextLine = p.booking ? `${UI.lf("booked")}Записана к пульмонологу · ${U.fmt.wdd(p.booking.off)}, ${p.booking.t}` : `${UI.lf("proposed")}Следующий шаг: консультация пульмонолога`;
    return `
    <div class="chooser">
      <div class="veil" aria-hidden="true"></div>
      <header class="ch-top">
        <a class="brand" href="#/" aria-label="Эгида">${Art.logo("draw")}<span class="word">Эгида</span><span class="tagline">Навигатор маршрута пациента</span></a>
        <button class="ib" data-act="theme" aria-label="Сменить тему">${icon("sun", "sun")}${icon("moon", "moon")}</button>
      </header>
      <main class="ch-main">
        <h1 class="ch-title">Кто вы сегодня?</h1>
        <p class="ch-sub">Прототип клиники «Эгида». Навигатор превращает заключение ИИ по КТ, маммографии или рентгену в следующий шаг пациента: координатор видит, кому позвонить, пациент — куда записаться.</p>
        <div class="ch-plates">
          <button class="ch-plate plate clips lit" data-act="enter" data-cab="patient" style="--k:0">
            <span class="film photo"><img src="${D.scenes.patientRole}" alt="" decoding="async"><span class="corner tl">ПАЦИЕНТ<br>${esc(p.short)} · ${p.age}</span><span class="corner tr">КАБИНЕТ<br>веб и телефон</span><span class="corner bl">План после КТ</span></span>
            <span class="ch-np"><span class="np-name">Кабинет пациента</span><span class="np-meta"><span>Галина Петровна</span><span>${UI.age(p.age)}</span><span>полис ОМС</span></span><span class="np-status">${nextLine}</span></span>
            <span class="ch-go">Войти как пациент ${icon("arrow-right", "s16")}</span>
          </button>
          <button class="ch-plate plate clips lit urgent" data-act="enter" data-cab="admin" style="--k:1">
            <span class="film photo"><img src="${D.scenes.clinicRole}" alt="" decoding="async"><span class="corner tl">КЛИНИКА<br>координатор · врач</span><span class="corner tr">СТОЛ<br>светятся: ${lit}</span><span class="corner bl">КТ · ММГ · РГ</span></span>
            <span class="ch-np"><span class="np-name">Кабинет клиники</span><span class="np-meta"><span>Ольга Белова, координатор</span><span>Ирина Павловна, врач</span></span><span class="np-status">${UI.lf("urgent")}${urgent} ${U.plural(urgent, ["срочный случай", "срочных случая", "срочных случаев"])} без записи</span></span>
            <span class="ch-go">Войти в клинику ${icon("arrow-right", "s16")}</span>
          </button>
        </div>
        <p class="ch-hint">${icon("route", "s16")}<span>Сквозной сценарий: запишите Соколову Г. П. в кабинете клиники, затем откройте кабинет пациента — новый шаг уже будет там.</span></p>
      </main>
      <footer class="ch-foot"><span class="demo-mark"><i></i>Все люди, заключения и цифры вымышлены</span><span>Кейс «Третьего мнения» · Meditron 2026</span><span>Фото: Unsplash (В. Гариев и др.)</span>${Object.keys(Store.state.bookings).length || Object.keys(Store.state.decisions).length ? `<button class="linkish" data-act="reset">Сбросить демо</button>` : ""}</footer>
    </div>`;
  }

  function mount(root) {
    root.innerHTML = html();
    // лампа мерцает при первом входе за сессию, дальше стол уже горит
    let first = !window.__lampOn;
    try { first = first && !sessionStorage.getItem("aegis-lamp"); sessionStorage.setItem("aegis-lamp", "1"); } catch (e) { /* без хранилища мерцаем один раз за загрузку */ }
    window.__lampOn = true;
    $(".chooser", root).classList.add(first && !U.reduced() ? "boot" : "warm");
    $$(".ch-plate img", root).forEach(img => img.addEventListener("error", () => img.closest(".film").classList.add("noimg")));
  }

  // плёнка раскрывается на весь экран и становится кабинетом
  U.on("enter", async el => {
    const cab = el.dataset.cab;
    const film = $(".film", el), r = film.getBoundingClientRect();
    if (U.reduced()) { App.go(cab); return; }
    const ghost = film.cloneNode(true);
    ghost.classList.add("ghost-film");
    Object.assign(ghost.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    document.body.appendChild(ghost);
    $(".chooser").classList.add("leaving");
    el.classList.add("chosen");
    const a = ghost.animate([
      { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", borderRadius: "8px" },
      { left: "0px", top: "0px", width: window.innerWidth + "px", height: window.innerHeight + "px", borderRadius: "0px" },
    ], { duration: 620, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" });
    await Promise.race([a.finished.catch(() => {}), U.sleep(800)]);
    App.go(cab);
    ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: "ease-out", fill: "forwards" });
    setTimeout(() => ghost.remove(), 460);
  });

  U.on("reset", () => { Store.reset(); U.toast("Демо сброшено", "Записи и решения вернулись к исходным", { icon: "rotate-ccw" }); App.rerender(); });

  window.Chooser = { mount };
})();
