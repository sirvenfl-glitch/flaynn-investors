/**
 * Starfield Canvas : flaynn.fr v3
 * 3 depth layers with wrapping parallax (stars always fill viewport)
 * Mouse drift + scroll parallax + warp stretching API
 */
;(function () {
  'use strict'

  var canvas = document.getElementById('starfield')
  if (!canvas) return
  var ctx = canvas.getContext('2d')

  /* ── Config ── */
  var LAYER_CONFIG = [
    { ratio: 0.45, speed: 0.08, size: [0.3, 1.0], opacity: [0.15, 0.40] },
    { ratio: 0.35, speed: 0.30, size: [0.7, 1.6], opacity: [0.30, 0.60] },
    { ratio: 0.20, speed: 0.75, size: [1.1, 2.8], opacity: [0.50, 1.0] }
  ]
  var BASE_COUNT = window.innerWidth < 640 ? 160 : window.innerWidth < 1024 ? 280 : 380
  var TWINKLE_SPEED = 0.0025
  var MOUSE_INFLUENCE = 12

  var stars = []
  var W = 0, H = 0
  var speedMultiplier = 1
  var scrollY = 0
  var mouseX = 0.5, mouseY = 0.5
  var rafId = null
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function rand(a, b) { return a + Math.random() * (b - a) }

  function resize() {
    W = canvas.width = window.innerWidth
    H = canvas.height = window.innerHeight
    if (stars.length === 0) createStars()
  }

  /**
   * Stars live in viewport coordinates [0..W, 0..H].
   * Each layer scrolls at its own rate and wraps vertically.
   */
  function createStars() {
    stars = []
    for (var li = 0; li < LAYER_CONFIG.length; li++) {
      var cfg = LAYER_CONFIG[li]
      var n = Math.round(BASE_COUNT * cfg.ratio)
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: rand(cfg.size[0], cfg.size[1]),
          opacity: rand(cfg.opacity[0], cfg.opacity[1]),
          speed: cfg.speed,
          twinkle: Math.random() * Math.PI * 2
        })
      }
    }
  }

  /* ── Draw ── */
  function draw(time) {
    ctx.clearRect(0, 0, W, H)

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i]

      // Parallax offset: each layer scrolls at different rate, wraps around
      var offsetY = (scrollY * s.speed * 0.8) % H
      var drawY = ((s.y - offsetY) % H + H) % H

      // Mouse drift (subtle)
      var mx = reducedMotion ? 0 : (mouseX - 0.5) * MOUSE_INFLUENCE * s.speed
      var my = reducedMotion ? 0 : (mouseY - 0.5) * MOUSE_INFLUENCE * s.speed
      var drawX = s.x + mx

      // Twinkle
      var tw = reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(time * TWINKLE_SPEED + s.twinkle)
      var alpha = s.opacity * tw

      // Warp stretching
      var sz = s.size
      var stretch = 1
      if (speedMultiplier > 1.3) {
        var wf = Math.min((speedMultiplier - 1) / 27, 1)
        stretch = 1 + wf * 25 * s.speed
        alpha = Math.min(1, alpha * (1 + wf))
        sz = s.size * (1 + wf * 0.5)
      }

      ctx.globalAlpha = alpha

      if (stretch > 2) {
        // Warp line
        var halfLen = sz * stretch * 0.5
        ctx.beginPath()
        ctx.moveTo(drawX, drawY - halfLen + my)
        ctx.lineTo(drawX, drawY + halfLen + my)
        ctx.lineWidth = sz * 0.7
        ctx.strokeStyle = '#fff'
        ctx.stroke()
      } else {
        // Circle
        ctx.beginPath()
        ctx.arc(drawX, drawY + my, sz * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  function loop(t) {
    draw(t)
    rafId = requestAnimationFrame(loop)
  }

  /* ── Events ── */
  window.addEventListener('scroll', function () {
    scrollY = window.pageYOffset || 0
  }, { passive: true })

  window.addEventListener('resize', resize)

  if (!reducedMotion) {
    document.addEventListener('mousemove', function (e) {
      mouseX = e.clientX / W
      mouseY = e.clientY / H
    }, { passive: true })
  }

  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) {
    reducedMotion = e.matches
  })

  /* ── Public API ── */
  window.Starfield = {
    setSpeed: function (v) { speedMultiplier = v },
    getSpeed: function () { return speedMultiplier },
    resize: resize,
    destroy: function () {
      cancelAnimationFrame(rafId)
    }
  }

  /* ── Init ── */
  scrollY = window.pageYOffset || 0
  resize()
  rafId = requestAnimationFrame(loop)
})()
