/**
 * flaynn.com — Warp + Fullpage Controller
 *
 * Scroll-driven warp visuals + app-style fullpage navigation.
 * Each wheel/touch/key gesture = one smooth page transition.
 * Easing: ease-out-expo (iOS-like deceleration).
 * Warp glow activates when scrolling through warp zones.
 */
;(function () {
  'use strict'

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) {
    reducedMotion = e.matches
  })

  /* ═══════════════════════════════════════════════
     1. WARP VISUAL EFFECT (scroll-driven)
     ═══════════════════════════════════════════════ */

  var overlay = document.getElementById('warp-overlay')
  var ctx = overlay ? overlay.getContext('2d') : null

  function resizeOverlay() {
    if (!overlay) return
    overlay.width = window.innerWidth
    overlay.height = window.innerHeight
  }
  resizeOverlay()
  window.addEventListener('resize', resizeOverlay)

  function ha(a) {
    var v = Math.round(Math.min(1, Math.max(0, a)) * 255)
    var h = v.toString(16)
    return h.length < 2 ? '0' + h : h
  }

  function makeLines(count) {
    var lines = []
    var maxDim = Math.max(window.innerWidth, window.innerHeight)
    for (var i = 0; i < count; i++) {
      lines.push({
        angle: Math.random() * Math.PI * 2,
        dist: 15 + Math.random() * maxDim * 0.12,
        len: 80 + Math.random() * maxDim * 0.55,
        width: 0.3 + Math.random() * 2.8,
        speed: 0.3 + Math.random() * 2.0,
        alpha: 0.15 + Math.random() * 0.85
      })
    }
    return lines
  }

  var lineCount = window.innerWidth < 640 ? 45 : 90
  var warpZones = [
    { el: document.getElementById('warp-zone-1'), color: '#7B2D8E', lines: makeLines(lineCount) },
    { el: document.getElementById('warp-zone-2'), color: '#E8651A', lines: makeLines(lineCount) }
  ]

  function zoneProgress(el) {
    if (!el) return -1
    var rect = el.getBoundingClientRect()
    var vh = window.innerHeight
    var p = (vh - rect.top) / (vh + rect.height)
    return Math.max(0, Math.min(1, p))
  }

  function bell(t) { return Math.sin(t * Math.PI) }

  function drawWarp(p, color, lines) {
    if (p < 0.005 || !ctx) return

    var cx = overlay.width / 2
    var cy = overlay.height / 2
    var maxDim = Math.max(overlay.width, overlay.height)

    // Deep glow
    var bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDim * 1.3)
    bg.addColorStop(0, color + ha(0.35 * p))
    bg.addColorStop(0.35, color + ha(0.14 * p))
    bg.addColorStop(1, color + '00')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, overlay.width, overlay.height)

    // White-hot core
    var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDim * 0.3 * p)
    core.addColorStop(0, '#ffffff' + ha(0.25 * p))
    core.addColorStop(0.25, color + ha(0.4 * p))
    core.addColorStop(1, color + '00')
    ctx.fillStyle = core
    ctx.fillRect(0, 0, overlay.width, overlay.height)

    // Warp lines
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i]
      var d1 = l.dist + l.len * p * l.speed
      var d2 = d1 + l.len * p * 1.4
      var x1 = cx + Math.cos(l.angle) * d1
      var y1 = cy + Math.sin(l.angle) * d1
      var x2 = cx + Math.cos(l.angle) * d2
      var y2 = cy + Math.sin(l.angle) * d2

      var grad = ctx.createLinearGradient(x1, y1, x2, y2)
      grad.addColorStop(0, color + ha(l.alpha * p * 0.9))
      grad.addColorStop(0.5, color + ha(l.alpha * p * 0.35))
      grad.addColorStop(1, color + '00')

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.strokeStyle = grad
      ctx.lineWidth = l.width * (0.3 + p * 2)
      ctx.stroke()
    }

    // Flash at peak
    if (p > 0.88) {
      ctx.fillStyle = 'rgba(255,255,255,' + ((p - 0.88) / 0.12 * 0.15) + ')'
      ctx.fillRect(0, 0, overlay.width, overlay.height)
    }

    // Vignette
    var vig = ctx.createRadialGradient(cx, cy, maxDim * 0.2, cx, cy, maxDim * 0.7)
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, 'rgba(0,0,0,' + (0.35 * p) + ')')
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, overlay.width, overlay.height)
  }

  function updateWarp() {
    if (!ctx || reducedMotion) return
    ctx.clearRect(0, 0, overlay.width, overlay.height)

    var totalWarp = 0
    for (var i = 0; i < warpZones.length; i++) {
      var z = warpZones[i]
      if (!z.el) continue
      var raw = zoneProgress(z.el)
      if (raw <= 0 || raw >= 1) continue
      var intensity = bell(raw)
      totalWarp += intensity
      drawWarp(intensity, z.color, z.lines)
    }

    var speed = 1 + 28 * Math.min(totalWarp, 1)
    if (window.Starfield) window.Starfield.setSpeed(speed)
  }

  /* ═══════════════════════════════════════════════
     2. FULLPAGE CONTROLLER (app-style 120Hz)
     ═══════════════════════════════════════════════ */

  // Collect snap-worthy pages in DOM order
  var pageEls = Array.prototype.slice.call(
    document.querySelectorAll(
      '#station-1, .station-2-intro, .stat-block, .punchline, #station-3'
    )
  )

  var current = 0
  var locked = false
  var touchStartY = 0
  var touchStartTime = 0

  function getScrollTarget(el) {
    var elTop = el.getBoundingClientRect().top + window.pageYOffset
    var elH = el.offsetHeight
    var vh = window.innerHeight
    // Center element in viewport. If taller than viewport, align top.
    if (elH >= vh) return elTop
    return Math.max(0, elTop - (vh - elH) / 2)
  }

  // Ease-out expo
  function easeOutExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -11 * t)
  }

  function animateScroll(from, to, duration, done) {
    var startTime = null

    function step(time) {
      if (!startTime) startTime = time
      var t = Math.min((time - startTime) / duration, 1)
      var eased = easeOutExpo(t)

      window.scrollTo(0, from + (to - from) * eased)

      // Update warp every frame during animation
      updateWarp()

      if (t < 1) {
        requestAnimationFrame(step)
      } else {
        setTimeout(function () {
          if (done) done()
        }, 120)
      }
    }

    requestAnimationFrame(step)
  }

  function goTo(index) {
    if (locked) return

    // Clamp
    if (index < 0) index = 0
    if (index >= pageEls.length) {
      // Scroll to bottom (footer)
      var docBottom = document.documentElement.scrollHeight - window.innerHeight
      var now = window.pageYOffset
      if (now >= docBottom - 5) return
      locked = true
      current = pageEls.length - 1
      animateScroll(now, docBottom, 1000, function () { locked = false })
      return
    }

    if (index === current && Math.abs(window.pageYOffset - getScrollTarget(pageEls[index])) < 5) return

    locked = true
    current = index

    var from = window.pageYOffset
    var to = getScrollTarget(pageEls[index])
    var dist = Math.abs(to - from)
    var vh = window.innerHeight

    // Duration: scales with distance, longer for warp zone crossings
    var duration = Math.min(2400, Math.max(1100, dist / vh * 1000))

    animateScroll(from, to, duration, function () { locked = false })
  }

  // Find closest page on load
  function findClosestPage() {
    var scrollTop = window.pageYOffset
    var closest = 0
    var minDist = Infinity
    for (var i = 0; i < pageEls.length; i++) {
      var d = Math.abs(getScrollTarget(pageEls[i]) - scrollTop)
      if (d < minDist) {
        minDist = d
        closest = i
      }
    }
    current = closest
  }
  findClosestPage()

  // ── Wheel ──
  function isModalOpen() {
    var modal = document.getElementById('legal-modal')
    return modal && modal.classList.contains('active')
  }

  window.addEventListener('wheel', function (e) {
    if (isModalOpen()) return
    e.preventDefault()
    if (locked) return

    var dir = e.deltaY > 0 ? 1 : -1
    goTo(current + dir)
  }, { passive: false })

  // ── Touch ──
  var touchMoved = false

  window.addEventListener('touchstart', function (e) {
    // Allow touch scrolling inside iPhone mockup
    var screen = document.getElementById('iphone-screen')
    if (screen && screen.contains(e.target)) return

    touchStartY = e.touches[0].clientY
    touchStartTime = Date.now()
    touchMoved = false
  }, { passive: true })

  window.addEventListener('touchmove', function (e) {
    if (isModalOpen()) return
    var screen = document.getElementById('iphone-screen')
    if (screen && screen.contains(e.target)) return

    var dy = Math.abs(e.touches[0].clientY - touchStartY)
    if (dy > 12) {
      touchMoved = true
      e.preventDefault()
    }
  }, { passive: false })

  window.addEventListener('touchend', function (e) {
    if (isModalOpen() || locked || !touchMoved) return
    var screen = document.getElementById('iphone-screen')
    if (screen && screen.contains(e.target)) return

    var delta = touchStartY - e.changedTouches[0].clientY
    var elapsed = Date.now() - touchStartTime
    var velocity = Math.abs(delta) / Math.max(elapsed, 1)
    if (Math.abs(delta) > 30 || velocity > 0.3) {
      goTo(current + (delta > 0 ? 1 : -1))
    }
  }, { passive: true })

  // ── Keyboard ──
  window.addEventListener('keydown', function (e) {
    if (isModalOpen() || locked) return
    if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault()
      goTo(current + 1)
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault()
      goTo(current - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      goTo(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      goTo(pageEls.length - 1)
    }
  })

  // ── Resize: re-snap ──
  var resizeTimer = null
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(function () {
      window.scrollTo(0, getScrollTarget(pageEls[current]))
    }, 200)
  })

  // ── Passive scroll listener for warp update ──
  window.addEventListener('scroll', function () {
    if (!locked) updateWarp()
  }, { passive: true })

  // Initial warp state
  updateWarp()

  /* ═══════════════════════════════════════════════
     3. REVEALS, TRACKING, CARD TILT, STAGGER
     ═══════════════════════════════════════════════ */

  // Scroll-based reveals
  var reveals = document.querySelectorAll('.reveal')
  if (reveals.length) {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('revealed')
          revealObs.unobserve(e.target)
        }
      })
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' })
    reveals.forEach(function (el) { revealObs.observe(el) })
  }

  // Punchline stagger
  var punchlineBlock = document.getElementById('punchline-block')
  if (punchlineBlock) {
    var punchlineLines = punchlineBlock.querySelectorAll('.punchline-line')
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        punchlineLines.forEach(function (line, i) {
          setTimeout(function () {
            line.classList.add('visible')
          }, i * 300)
        })
      }
    }, { threshold: 0.3 }).observe(punchlineBlock)
  }

  // Vision headline stagger
  var visionBlock = document.getElementById('vision-headline')
  if (visionBlock) {
    var visionLines = visionBlock.querySelectorAll('.vision-line')
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        visionLines.forEach(function (line, i) {
          setTimeout(function () {
            line.classList.add('visible')
          }, i * 300)
        })
      }
    }, { threshold: 0.3 }).observe(visionBlock)
  }

  // iPhone frame fade-in
  var iphoneFrame = document.getElementById('iphone-frame')
  if (iphoneFrame) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        iphoneFrame.classList.add('visible')
      }
    }, { threshold: 0.2 }).observe(iphoneFrame)
  }

  // Plausible events
  function track(name) {
    if (window.plausible) window.plausible(name)
  }

  var trackMap = {
    'station-2': 'scroll_station_2',
    'station-3': 'scroll_station_3'
  }
  Object.keys(trackMap).forEach(function (id) {
    var el = document.getElementById(id)
    if (!el) return
    var done = false
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && !done) {
        done = true
        track(trackMap[id])
      }
    }, { threshold: 0.05 }).observe(el)
  })

  // Scoring card 3D tilt
  var card = document.querySelector('.scoring-card')
  if (card && !reducedMotion) {
    card.addEventListener('mousemove', function (e) {
      var r = card.getBoundingClientRect()
      var x = (e.clientX - r.left) / r.width
      var y = (e.clientY - r.top) / r.height
      card.style.transform =
        'perspective(800px) rotateX(' + ((0.5 - y) * 18) +
        'deg) rotateY(' + ((x - 0.5) * 18) +
        'deg) scale(1.03)'
    })
    card.addEventListener('mouseleave', function () {
      card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)'
    })
  }

  // Score bar fill
  var bars = document.querySelectorAll('.score-bar-fill')
  if (bars.length) {
    var barObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var bar = e.target
          setTimeout(function () {
            bar.style.width = bar.getAttribute('data-width') + '%'
          }, 300)
          barObs.unobserve(bar)
        }
      })
    }, { threshold: 0.2 })
    bars.forEach(function (b) { barObs.observe(b) })
  }

  // CTA tracking
  var cta = document.querySelector('.btn-cta')
  if (cta) cta.addEventListener('click', function () { track('cta_contact_click') })
})()
