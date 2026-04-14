/**
 * phone-content.js — iPhone mockup scroll tracking
 * Fires Plausible event when user scrolls to the bottom of the phone content.
 */
;(function () {
  'use strict'

  var screen = document.getElementById('iphone-screen')
  if (!screen) return

  var tracked = false

  screen.addEventListener('scroll', function () {
    if (tracked) return
    var atBottom = screen.scrollTop + screen.clientHeight >= screen.scrollHeight - 20
    if (atBottom) {
      tracked = true
      if (window.plausible) window.plausible('phone_scroll_complete')
    }
  }, { passive: true })
})()
