const Selectors = {
  progress: "#progress",
  slide: ".slides > li",
  firstSlide: ".slide:first-of-type",
  endSlide: ".slide:last-of-type",
  prevSlide: ".prev",
  currentSlide: ".current",
  nextSlide: ".next",
  allSlidesAfterSlides: ".current ~ .slide",
  container: ".slides",
  title: "title",
  main: "main",
  slideSelector: ".slide-selector",
  timerController: ".timer-controller",
  slideSelectorInput: ".slide-selector input",
  timerSelectorInput: ".timer-controller input",
  codeForResize: "[data-code]",
  htmlForCleanup: "[data-html]",
  captions: ".caption span",
};

const ClassNames = {
  prevSlide: "prev",
  currentSlide: "current",
  nextSlide: "next",
  slide: "slide",
  fullscreen: "fullscreen",
  slideSelector: "slide-selector",
  slideSelectorVisibility: "visible",
  timerControllerVisibility: "visible",
  teleprompter: "teleprompter",
  captions: "captions",
};

export { ClassNames, Selectors };