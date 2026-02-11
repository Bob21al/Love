// Элементы
const prevBtn = document.querySelector("#prev-btn");
const nextBtn = document.querySelector("#next-btn");
const book = document.querySelector("#book");
const body = document.querySelector("body");
const introScreen = document.querySelector("#intro-screen");
const introStartBtn = document.querySelector("#intro-start-btn");
const siteLoader = document.querySelector("#site-loader");
const allImages = Array.from(document.querySelectorAll("img, .photo-placeholder"));
const bgMusic = document.querySelector("#background-music");

const papers = Array.from(document.querySelectorAll(".paper"));

let currentLocation = 0;
const maxLocation = papers.length;
let openAnimationTimeout;
let isPageTurning = false;
let isIntroCompleted = false;
let isSiteReady = false;

const DEBUG_PAGE_TURN = true;
const PAGE_TURN_TIMEOUT_MS = 1200;

// Слушатели
prevBtn.addEventListener("click", goPrevPage);
nextBtn.addEventListener("click", goNextPage);
papers[0].addEventListener("click", goNextPage);
introStartBtn.addEventListener("click", startIntroExperience);

window.addEventListener("load", preloadSiteAssets);

function preloadSiteAssets() {
    const imageUrls = allImages
        .map((el) => {
            if (el.tagName === "IMG") return el.src;
            const inlineBg = el.style.backgroundImage || "";
            const match = inlineBg.match(/url\(['"]?(.*?)['"]?\)/);
            return match ? match[1] : null;
        })
        .filter(Boolean);

    const preloadPromises = imageUrls.map((src) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve;
            img.src = src;
        });
    });

    preloadPromises.push(
        new Promise((resolve) => {
            if (!bgMusic) return resolve();
            const done = () => {
                bgMusic.removeEventListener("canplaythrough", done);
                resolve();
            };
            bgMusic.addEventListener("canplaythrough", done, { once: true });
            bgMusic.load();
            setTimeout(done, 2500);
        })
    );

    Promise.all(preloadPromises).then(() => {
        isSiteReady = true;
        body.classList.remove("loading-site");
        siteLoader.classList.add("hidden");
        introStartBtn.disabled = false;
        introStartBtn.textContent = "нажми";
    });
}

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
const SWIPE_THRESHOLD = 45;
const SWIPE_MAX_Y_DIFF = 80;

book.addEventListener("touchstart", handleTouchStart, { passive: true });
book.addEventListener("touchend", handleTouchEnd, { passive: true });

function handleTouchStart(event) {
    if (!isIntroCompleted || isPageTurning) return;
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
}

function handleTouchEnd(event) {
    if (!isIntroCompleted || isPageTurning) return;
    const touch = event.changedTouches[0];
    touchEndX = touch.clientX;
    touchEndY = touch.clientY;

    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);

    if (diffY > SWIPE_MAX_Y_DIFF || Math.abs(diffX) < SWIPE_THRESHOLD) {
        return;
    }

    if (diffX < 0) {
        goNextPage();
    } else {
        goPrevPage();
    }
}

function startIntroExperience() {
    if (isIntroCompleted || !isSiteReady) return;

    isIntroCompleted = true;

    book.classList.remove("pre-intro");
    void book.offsetWidth;
    book.classList.add("reveal");

    introScreen.classList.add("hidden");

    setTimeout(() => {
        introScreen.style.display = "none";
    }, 650);

    updateNavButtons();
}

function openBook() {
    book.classList.add("open");
    book.classList.remove("close-right"); // Убираем класс закрытия справа
    body.classList.add("btns-visible");

    // Запуск музыки при открытии книги
    playBackgroundMusic();

    // Триггерим отдельную стильную анимацию приближения при открытии
    book.classList.remove("is-opening");
    void book.offsetWidth; // принудительный reflow для повторного запуска анимации
    book.classList.add("is-opening");

    clearTimeout(openAnimationTimeout);
    openAnimationTimeout = setTimeout(() => {
        book.classList.remove("is-opening");
    }, 950);
}

function closeBook(isAtBeginning) {
    clearTimeout(openAnimationTimeout);
    book.classList.remove("is-opening");

    if(isAtBeginning) {
        book.classList.remove("open");
        body.classList.remove("btns-visible");
    } else {
        // Книга закрыта в конце
        book.classList.remove("open");
        book.classList.add("close-right"); // Добавляем спец. класс для тени
    }
}

function updateNavButtons() {
    if (!isIntroCompleted) {
        prevBtn.classList.add("hidden");
        nextBtn.classList.add("hidden");
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }

    // Блокируем кнопки во время анимации перелистывания
    prevBtn.disabled = isPageTurning;
    nextBtn.disabled = isPageTurning;

    if (isPageTurning) {
        prevBtn.classList.add("hidden");
        nextBtn.classList.add("hidden");
        return;
    }

    // Скрываем/показываем кнопки в зависимости от текущей страницы
    if (currentLocation === 0) {
        prevBtn.classList.add("hidden");
        nextBtn.classList.remove("hidden");
    } else if (currentLocation === maxLocation) {
        prevBtn.classList.remove("hidden");
        nextBtn.classList.add("hidden");
    } else {
        prevBtn.classList.remove("hidden");
        nextBtn.classList.remove("hidden");
    }
}

function waitForPageTurn(page, onDone) {
    let finished = false;

    const finishTurn = (reason) => {
        if (finished) return;
        finished = true;

        page.removeEventListener("transitionend", onTransitionEnd);
        clearTimeout(fallbackTimeout);

        isPageTurning = false;
        if (DEBUG_PAGE_TURN) {
            console.log(`[DEBUG] Перелистывание завершено (${reason}). Текущая позиция: ${currentLocation}`);
        }

        onDone();
    };

    const onTransitionEnd = (event) => {
        if (event.propertyName !== "transform") return;
        finishTurn("transitionend");
    };

    page.addEventListener("transitionend", onTransitionEnd);

    const fallbackTimeout = setTimeout(() => {
        finishTurn("fallback-timeout");
    }, PAGE_TURN_TIMEOUT_MS);
}

function goNextPage() {
    if (!isIntroCompleted) return;

    if (isPageTurning) {
        if (DEBUG_PAGE_TURN) console.log("[DEBUG] Клик Next проигнорирован: страница еще перелистывается");
        return;
    }

    if(currentLocation < maxLocation) {
        if(currentLocation === 0) openBook();

        const turningPage = papers[currentLocation];
        isPageTurning = true;
        updateNavButtons();

        turningPage.classList.add("is-turning");
        turningPage.classList.add("flipped");
        currentLocation++;

        if (DEBUG_PAGE_TURN) {
            console.log(`[DEBUG] Начато перелистывание вперед. Целевая позиция: ${currentLocation}`);
        }

        waitForPageTurn(turningPage, () => {
            turningPage.classList.remove("is-turning");
            if(currentLocation === maxLocation) closeBook(false);
            updateNavButtons();
        });
    }
}

function goPrevPage() {
    if (!isIntroCompleted) return;

    if (isPageTurning) {
        if (DEBUG_PAGE_TURN) console.log("[DEBUG] Клик Prev проигнорирован: страница еще перелистывается");
        return;
    }

    if(currentLocation > 0) {
        // Если возвращаемся с задней обложки, снова открываем книгу
        if(currentLocation === maxLocation) {
            openBook();
        }

        currentLocation--;
        const turningPage = papers[currentLocation];
        isPageTurning = true;
        updateNavButtons();

        turningPage.classList.add("is-turning");
        turningPage.classList.remove("flipped");

        if (DEBUG_PAGE_TURN) {
            console.log(`[DEBUG] Начато перелистывание назад. Целевая позиция: ${currentLocation}`);
        }

        waitForPageTurn(turningPage, () => {
            turningPage.classList.remove("is-turning");
            if(currentLocation === 0) closeBook(true);
            updateNavButtons();
        });

    }
}

updateNavButtons();

// Флаг, чтобы не запускать музыку повторно
let isMusicStarted = false;

// Функция для запуска музыки с плавным увеличением громкости
function playBackgroundMusic() {
    if (isMusicStarted) return;

    const audio = document.getElementById('background-music');
    
    // Начальная громкость устанавливается в 0
    audio.volume = 0;
    
    // Попытка начать воспроизведение
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
        playPromise.then(() => {
            // Воспроизведение успешно началось, запускаем плавное увеличение громкости
            console.log('Музыка начала воспроизводиться');
            isMusicStarted = true;
            
            // Плавное увеличение громкости
            fadeInAudio(audio, 0.5, 6000); // Плавное увеличение до 50% за 6 секунд
        }).catch(error => {
            // Автовоспроизведение было заблокировано, ждем взаимодействия пользователя
            console.log('Автовоспроизведение заблокировано, музыка начнется при взаимодействии');
            
            // Попытка воспроизведения при любом взаимодействии пользователя
            const playOnInteraction = () => {
                audio.play().then(() => {
                    console.log('Музыка начала воспроизводиться после взаимодействия');
                    isMusicStarted = true;
                    // Плавное увеличение громкости
                    fadeInAudio(audio, 0.5, 6000);
                }).catch(e => {
                    console.error('Ошибка при попытке воспроизвести музыку:', e);
                });
                
                // Удаляем обработчики после первого успешного запуска
                document.removeEventListener('click', playOnInteraction);
                document.removeEventListener('touchstart', playOnInteraction);
                document.removeEventListener('keydown', playOnInteraction);
            };
            
            // Добавляем обработчики для различных событий
            document.addEventListener('click', playOnInteraction);
            document.addEventListener('touchstart', playOnInteraction);
            document.addEventListener('keydown', playOnInteraction);
        });
    }
}

// Функция для плавного увеличения громкости
function fadeInAudio(audio, targetVolume, duration) {
    const startVolume = audio.volume;
    const startTime = Date.now();
    
    function fadeStep() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        audio.volume = startVolume + (targetVolume - startVolume) * progress;
        
        if (progress < 1) {
            setTimeout(fadeStep, 10);
        } else {
            audio.volume = targetVolume; // гарантируем установку точного значения
        }
    }
    
    fadeStep();
}

// Музыка запускается при открытии книги (в openBook)
