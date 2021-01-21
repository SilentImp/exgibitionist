import Keys from "./Keys.mjs";
import { Selectors, ClassNames } from "./Selectors.mjs";
import isTouchDevice from "./isTouchDevice.mjs";
import isElementVisible from "./isElementVisible.mjs";
import Options from "./Options.mjs";
import StateURL from "./StateURL.mjs";
import MessageController from "./MessageController.mjs";
import calculateMaxFontSize from "./calculateMaxFontSize.mjs";

class SlideController {
  static messenger = new MessageController();

  constructor () {
    // Binding this to all class methods
    for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
      const method = this[name];
      if (name !== 'constructor' && typeof method === 'function') {
        this[name] = method.bind(this);
      }
    }

    this.currentSlide = 0;
    this.totalSlides = Infinity;
    this.isTouchDevice = isTouchDevice();

    this.container = null;
    this.main = null;
    this.progressBar = null;
    this.slides = null;
    this.slideSelector = null;
    this.slideSelectorInput = null;
    this.mode = StateURL.caption;
    this.setMode(this.mode);
    SlideController.messenger.setBroadcast(StateURL.broadcast);

    // Swipe
    this.xDown = null;
    this.yDown = null;

    // Keys
    this.controlsPressed = [];
    this.nextKeys = [Keys.PgDown, Keys.Down, Keys.Right, Keys.L, Keys.J];
    this.prevKeys = [Keys.PgUp, Keys.Up, Keys.Left, Keys.H, Keys.K];
    this.controlsKeys = [Keys.cmd, Keys.ctrl, Keys.alt, Keys.shift];
    this.selectKeys = [Keys.enter];
    this.exitFullscreenKeys = [Keys.esc];
    this.enterFullscreenKeys = [Keys.enter, Keys.F];
    this.slideSelectorKeys = [Keys.P];
    this.captionKeys = [Keys.C];
    this.broadcastKeys = [Keys.B];

    // Check page structure
    this.progressBar = document.querySelector(Selectors.progress);
    if (this.progressBar === null) throw new Error("Progress bar not found");
    this.container = document.querySelector(Selectors.container);
    if (this.container === null) throw new Error("Slides container not found");
    this.main = document.querySelector(Selectors.main);
    if (this.main === null) throw new Error("Main container not found");
    this.slides = this.container.querySelectorAll(Selectors.slide);
    if (this.slides === null) throw new Error("No slides found");
    this.slideSelector = document.querySelector(Selectors.slideSelector);
    if (this.slideSelector === null) throw new Error("Can't find page control form");
    this.slideSelectorInput = document.querySelector(Selectors.slideSelectorInput);
    if (this.slideSelectorInput === null) throw new Error("Can't find input in page control form");

    // Transform NodeList to Array
    this.slides = [...this.slides];
    this.totalSlides = this.slides.length;

    // Give slides a number and tabindex
    this.slides.forEach((slide, index) => {
      slide.firstElementChild.setAttribute('data-number', index + 1);
      slide.setAttribute('tabindex', 0);
    });

    // const html = document.querySelectorAll(Selectors.htmlForCleanup);
    // if (html !== null) {
    //   [...html].forEach(element => {
    //     element.innerHTML = SlideController.sanitize(element.innerHTML);
    //   })
    // }

    // Set font-size for the code
    const code = document.querySelectorAll(Selectors.codeForResize);
    if (code !== null) {
      [...code].forEach(element => {
        element.style.setProperty('--code', `${element.dataset.code}px`);
      })
    }

    // Set browser events
    document.addEventListener('touchstart', this.handleTouchStart, false);        
    document.addEventListener('touchmove', this.handleTouchMove, false);
    document.addEventListener('click', this.clickController);
    document.addEventListener('dblclick', this.dblClickController);
    document.addEventListener('keydown', this.keyDownController);
    document.addEventListener('keyup', this.keyUpController);
    this.slideSelector.addEventListener('submit', this.slideSelectorSubmit);

    // Set messager
    SlideController.messenger.register('slidecontroller:fullscreenchange', this.fullScreenChange);
    SlideController.messenger.register('slidecontroller:change', this.updateProgress);
    SlideController.messenger.register('slidecontroller:change', this.scrollToCurrent);
    SlideController.messenger.register('slidecontroller:select', this.markSlide);
    SlideController.messenger.register('slidecontroller:captions', this.switchCaptionMode);

    // Get current slide from hash
    this.slideFromString();

    // select current slide
    SlideController.messenger.post("slidecontroller:select", {
      detail: {
        slideNumber: this.currentSlide,
      },
      bubbles: true,
    });

    // update progress component
    this.updateProgress();

    // calculate scale and update it on window resize
    this.calculateScale();
    const resizeObserver = new ResizeObserver(this.calculateScale);
    resizeObserver.observe(window.document.body);

    // Get fullscreen state from search query
    if (StateURL.fullscreen) {
      SlideController.messenger.post("slidecontroller:fullscreenchange", {
        detail: {
          force: StateURL.fullscreen
        }
      });
    }

    const captions = this.container.querySelectorAll('.caption span');
    if (captions) [...captions].forEach(calculateMaxFontSize);

    this.container.style.visibility = 'visible';
  }

  setMode (mode) {
    const modeName = Options.captionModeEnum[mode];
    if (modeName) window.document.documentElement.classList.toggle(modeName, true);
  }

  clearMode (mode) {
    const modeName = Options.captionModeEnum[mode];
    if (modeName) window.document.documentElement.classList.toggle(modeName, false);
  }

  handleTouchStart (event) {
    if (!StateURL.fullscreen || !this.isTouchDevice) {
      return;
    }
    const firstTouch = event.touches[0];
    this.xDown = firstTouch.clientX;
    this.yDown = firstTouch.clientY;
  }

  handleTouchMove (event) {
    if ( !StateURL.fullscreen || !this.isTouchDevice || !this.xDown || !this.yDown ) {
      return;
    }

    const xUp = event.touches[0].clientX;
    const yUp = event.touches[0].clientY;

    const xDiff = this.xDown - xUp;
    const yDiff = this.yDown - yUp;

    if ( Math.abs(xDiff) < Options.swipeThreshold && Math.abs(yDiff) < Options.swipeThreshold) {
      return;
    }

    // let sliderEvent;
    if ( Math.abs(xDiff) > Math.abs(yDiff) ) {
      /*most significant*/
      if ( xDiff > 0 ) {
        /* left swipe */
        SlideController.messenger.post("slidecontroller:select", {
          detail: {
            slideNumber: this.cicleSlideNumber(this.currentSlide + 1),
          },
          bubbles: true,
        });
      } else {
        /* right swipe */
        SlideController.messenger.post("slidecontroller:select", {
          detail: {
            slideNumber: this.cicleSlideNumber(this.currentSlide - 1),
          },
          bubbles: true,
        });
      }                       
    } else {
      if ( yDiff > 0 ) {
        /* up swipe */
        SlideController.messenger.post("slidecontroller:select", {
          detail: {
            slideNumber: this.cicleSlideNumber(this.currentSlide + 1),
          },
          bubbles: true,
        });
      } else { 
        /* down swipe */
        SlideController.messenger.post("slidecontroller:select", {
          detail: {
            slideNumber: this.cicleSlideNumber(this.currentSlide - 1),
          },
          bubbles: true,
        });
      }
    }

    /* reset values */
    this.xDown = null;
    this.yDown = null;
  }

  // Get slide number from hash and set it as instanse state
  slideFromString () {
    const { slide } = StateURL;
    this.currentSlide = parseInt(slide) - 1;
  }

  safeSlideNumber(index) {
    if (Number.isNaN(index) || (index < 0)) return 0;
    if (index >= this.totalSlides) return this.totalSlides - 1;
    return index;
  }

  cicleSlideNumber(index) {
    if (index < 0) return this.totalSlides - 1;
    if (index >= this.totalSlides) return 0;
    return index;
  }

  scrollToCurrent (event) {
    const animated = !!event?.detail?.animated;
    // We can't scroll in the fullscreen mode
    if (StateURL.fullscreen) return;
    // We should do it on next cicle, when redraw happen and we can check if slide in the viewport
    setTimeout(() => {
      if (!isElementVisible(this.slides[this.currentSlide], 90)) {
        const endPos = this.slides[this.currentSlide].offsetTop - 20;
        window.scroll({
          top: endPos,
          left: 0,
          behavior: animated ? 'smooth' : 'auto',
        });
      }
    }, 50);

  }

  calculateScale () {
    // Scale for full screen
    const scale = 1/Math.max(
      this.slides[this.currentSlide].clientWidth/window.innerWidth, 
      this.slides[this.currentSlide].clientHeight/window.innerHeight
    );
    document.documentElement.style.setProperty('--scale', scale);

    // scale for slide list
    const slideWidth = getComputedStyle(document.documentElement).getPropertyValue('--slide-width');
    const columnWidth = getComputedStyle(this.container).getPropertyValue('--column-width');
    const div = document.createElement('div');
    div.style.width = columnWidth;
    document.body.appendChild(div);
    const columnWidthCalculated = div.offsetWidth;
    div.remove();

    document.documentElement.style.setProperty('--list-scale', (columnWidthCalculated/parseInt(slideWidth,10)).toPrecision(3));
  }

  static getElementNumber(element) {
    return element.firstElementChild.getAttribute('data-number') - 1;
  }

  slideSelectorSubmit (event) {
    event.preventDefault();
    const form = event.currentTarget;
    let slideNumber = parseInt(this.slideSelectorInput.value) - 1;

    SlideController.messenger.post("slidecontroller:select", {
      detail: {
        slideNumber: this.safeSlideNumber(slideNumber),
      },
      bubbles: true,
    });

    this.toggleSlideSelector();
    form.reset();
  }

  dblClickController (event) {
    const element = event.target;
    if (element.classList.contains(ClassNames.slide)) {
      SlideController.messenger.post("slidecontroller:select", {
        detail: {
          slideNumber: SlideController.getElementNumber(element),
        },
        bubbles: true,
      });
      SlideController.messenger.post("slidecontroller:fullscreenchange", {
        detail: {
          force: !StateURL.fullscreen,
        },
      });
    }
  }

  clickController (event) {
    if (StateURL.fullscreen) return;
    const element = event.target;
    if (element.classList.contains(ClassNames.slide)) {
      SlideController.messenger.post("slidecontroller:select", {
        detail: {
          slideNumber: SlideController.getElementNumber(element),
        },
        bubbles: true,
      });
    }
  }

  keyUpController (event) {
    const index = this.controlsPressed.indexOf(event.which);
    if (index > -1) {
      this.controlsPressed.splice(index, 1);
    }
  }

  keyDownController (event) {
    const element = event.target;

    // Control keys
    if (this.controlsKeys.includes(event.which) && !this.controlsPressed.includes(event.which)) {
      this.controlsPressed.push(event.which);
      return;
    }

    // Show slide selection form
    if (this.slideSelectorKeys.includes(event.which)) {
      event.preventDefault();
      this.toggleSlideSelector();
    }

    // Turn on captions
    if (this.captionKeys.includes(event.which)) {
      event.preventDefault();
      SlideController.messenger.post("slidecontroller:captions", {
        broadcast: false,
      });
    }

    // Select next slide
    if (this.nextKeys.includes(event.which)) {
      SlideController.messenger.post("slidecontroller:select", {
        detail: {
          slideNumber: this.cicleSlideNumber(this.currentSlide + 1),
        },
        bubbles: true,
      });
    }

    // Select previous slide
    if (this.prevKeys.includes(event.which)) {
      SlideController.messenger.post("slidecontroller:select", {
        detail: {
          slideNumber: this.cicleSlideNumber(this.currentSlide - 1),
        },
        bubbles: true,
      });
    }

    // Enable/diable broadcast
    if (this.broadcastKeys.includes(event.which)) {
      SlideController.messenger.toggleBroadcast();
      StateURL.broadcast = SlideController.messenger.isBroadcastEnabled;
    }

    // Select focused slide
    if (this.selectKeys.includes(event.which) && (element.classList.contains(ClassNames.slide))) {
      SlideController.messenger.post("slidecontroller:select", {
        detail: {
          slideNumber: SlideController.getElementNumber(element),
        },
        bubbles: true,
      });
    }

    // Esc to exit fullscreen
    if (this.exitFullscreenKeys.includes(event.which)) {
      // If form of page select is open and visible — close it
      if (this.slideSelector.classList.contains(ClassNames.slideSelectorVisibility)) {
        this.toggleSlideSelector();
      } else if (StateURL.fullscreen) { // if no page selector visible, but we are in fullscreen mode
        SlideController.messenger.post("slidecontroller:fullscreenchange", {
          detail: {
            force: false,
          },
        });
      }
    }

    // Enter to switch fullscreen
    if (this.enterFullscreenKeys.includes(event.which)) {
      if (event.target.classList.contains(ClassNames.slide) || event.target.tagName === 'BODY') {
        SlideController.messenger.post("slidecontroller:fullscreenchange", {
          detail: {
            force: !StateURL.fullscreen
          }
        });
      }
    }
  }

  // show or hide form to select slide
  toggleSlideSelector () {
    this.slideSelector.classList.toggle(ClassNames.slideSelectorVisibility);
    if (this.slideSelector.classList.contains(ClassNames.slideSelectorVisibility)) this.slideSelectorInput.focus();
  }

  // get prev slide element
  getPrevSlide (slideNumber) {
    return this.slides[slideNumber - 1] === undefined 
      ? this.slides[this.totalSlides - 1] 
      : this.slides[slideNumber - 1];
  }

  // get next slide element
  getNextSlide (slideNumber) {
    return this.slides[slideNumber + 1] === undefined 
      ? this.slides[0] 
      : this.slides[slideNumber + 1];
  }

  // mark element as current slide
  markSlide (event) {
    const slideNumber = this.safeSlideNumber(event?.detail?.slideNumber);

    // remove old classes
    this.getPrevSlide(this.currentSlide).classList.toggle(ClassNames.prevSlide, false); 
    this.getNextSlide(this.currentSlide).classList.toggle(ClassNames.nextSlide, false);
    this.slides[this.currentSlide].classList.toggle(ClassNames.currentSlide, false);

    // add new classes
    this.getPrevSlide(slideNumber).classList.toggle(ClassNames.prevSlide, true); 
    this.getNextSlide(slideNumber).classList.toggle(ClassNames.nextSlide, true);
    this.slides[slideNumber].classList.toggle(ClassNames.currentSlide, true);

    this.slides[slideNumber].focus();

    // update instance state
    this.currentSlide = slideNumber;

    // update URL
    StateURL.slide = slideNumber + 1;

    // update progress
    SlideController.messenger.post("slidecontroller:change", {
      detail: {
        animated: false,
      },
    });
  }

  // toggle fullscreen mode
  fullScreenChange (event) {
    const force = event?.detail?.force;
    window.document.documentElement.classList.toggle(ClassNames.fullscreen, force);
    StateURL.fullscreen = force;

    // scroll to slide in the list mode
    SlideController.messenger.post("slidecontroller:change", {
      detail: {
        animated: false,
      },
    });
  }

  // update state of slide progress bar
  updateProgress () {
    this.progressBar.setAttribute("max", this.totalSlides);
    this.progressBar.setAttribute("value", this.currentSlide + 1);
    this.progressBar.innerHTML = `${this.currentSlide + 1}/${this.totalSlides}`;
  }

  // captions
  switchCaptionMode () {
    this.clearMode(this.mode);
    this.mode = (this.mode + 1) % Options.captionModeEnum.length;
    this.setMode(this.mode);
    StateURL.caption = Options.captionModeEnum[this.mode];
    window.requestAnimationFrame(this.calculateScale);
  }
}

new SlideController();