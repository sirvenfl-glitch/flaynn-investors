/**
 * flaynn.com : Warp + Fullpage Controller (generalized)
 *
 * Works on any page that includes:
 *   - #warp-overlay canvas (optional)
 *   - .warp-zone elements with data-warp-color="violet|orange" (optional)
 *   - .snap-point elements for fullpage scroll (optional)
 *
 * If no .snap-point elements are present, fullpage controller is skipped
 * (regular scrolling). Reveals, card tilt, and score bars work regardless.
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

  var colorMap = { violet: '#7B2D8E', orange: '#E8651A' }
  var lineCount = window.innerWidth < 640 ? 45 : 90

  var warpZones = []
  var zoneEls = document.querySelectorAll('.warp-zone')
  for (var zi = 0; zi < zoneEls.length; zi++) {
    var el = zoneEls[zi]
    var key = el.getAttribute('data-warp-color') || 'violet'
    warpZones.push({
      el: el,
      color: colorMap[key] || colorMap.violet,
      lines: makeLines(lineCount)
    })
  }

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

    var bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDim * 1.3)
    bg.addColorStop(0, color + ha(0.35 * p))
    bg.addColorStop(0.35, color + ha(0.14 * p))
    bg.addColorStop(1, color + '00')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, overlay.width, overlay.height)

    var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDim * 0.3 * p)
    core.addColorStop(0, '#ffffff' + ha(0.25 * p))
    core.addColorStop(0.25, color + ha(0.4 * p))
    core.addColorStop(1, color + '00')
    ctx.fillStyle = core
    ctx.fillRect(0, 0, overlay.width, overlay.height)

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

    if (p > 0.88) {
      ctx.fillStyle = 'rgba(255,255,255,' + ((p - 0.88) / 0.12 * 0.15) + ')'
      ctx.fillRect(0, 0, overlay.width, overlay.height)
    }

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
     2. FULLPAGE CONTROLLER (only if .snap-point exist)
     ═══════════════════════════════════════════════ */

  var pageEls = Array.prototype.slice.call(document.querySelectorAll('.snap-point'))
  var fullpageActive = pageEls.length > 0

  var current = 0
  var locked = false
  var touchStartY = 0
  var touchStartTime = 0

  function getScrollTarget(el) {
    var elTop = el.getBoundingClientRect().top + window.pageYOffset
    var elH = el.offsetHeight
    var vh = window.innerHeight
    if (elH >= vh) return elTop
    return Math.max(0, elTop - (vh - elH) / 2)
  }

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
    if (locked || !fullpageActive) return

    if (index < 0) index = 0
    if (index >= pageEls.length) {
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

    var duration = Math.min(2400, Math.max(1100, dist / vh * 1000))

    animateScroll(from, to, duration, function () { locked = false })
  }

  function findClosestPage() {
    if (!fullpageActive) return
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

  function isModalOpen() {
    var modal = document.getElementById('legal-modal')
    return modal && modal.classList.contains('active')
  }

  if (fullpageActive) {
    window.addEventListener('wheel', function (e) {
      if (isModalOpen()) return
      e.preventDefault()
      if (locked) return

      var dir = e.deltaY > 0 ? 1 : -1
      goTo(current + dir)
    }, { passive: false })

    window.addEventListener('touchstart', function (e) {
      touchStartY = e.touches[0].clientY
      touchStartTime = Date.now()
    }, { passive: true })

    var touchMoved = false
    window.addEventListener('touchmove', function (e) {
      if (isModalOpen()) return
      var dy = Math.abs(e.touches[0].clientY - touchStartY)
      if (dy > 12) {
        touchMoved = true
        e.preventDefault()
      }
    }, { passive: false })

    window.addEventListener('touchend', function (e) {
      if (isModalOpen() || locked || !touchMoved) { touchMoved = false; return }
      var delta = touchStartY - e.changedTouches[0].clientY
      var elapsed = Date.now() - touchStartTime
      var velocity = Math.abs(delta) / Math.max(elapsed, 1)
      if (Math.abs(delta) > 30 || velocity > 0.3) {
        goTo(current + (delta > 0 ? 1 : -1))
      }
      touchMoved = false
    }, { passive: true })

    window.addEventListener('keydown', function (e) {
      if (isModalOpen() || locked) return
      var tag = (e.target && e.target.tagName) || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
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

    var resizeTimer = null
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(function () {
        window.scrollTo(0, getScrollTarget(pageEls[current]))
      }, 200)
    })
  }

  window.addEventListener('scroll', function () {
    if (!locked) updateWarp()
  }, { passive: true })

  updateWarp()

  /* ═══════════════════════════════════════════════
     3. REVEALS, CARD TILT, SCORE BARS, PUNCHLINES
     ═══════════════════════════════════════════════ */

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

  var punchlineBlocks = document.querySelectorAll('.punchline')
  punchlineBlocks.forEach(function (block) {
    var lines = block.querySelectorAll('.punchline-line')
    if (!lines.length) return
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        lines.forEach(function (line, i) {
          setTimeout(function () { line.classList.add('visible') }, i * 300)
        })
      }
    }, { threshold: 0.3 }).observe(block)
  })

  var cards = document.querySelectorAll('.scoring-card')
  if (!reducedMotion) {
    cards.forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect()
        var x = (e.clientX - r.left) / r.width
        var y = (e.clientY - r.top) / r.height
        card.style.transform =
          'perspective(800px) rotateX(' + ((0.5 - y) * 14) +
          'deg) rotateY(' + ((x - 0.5) * 14) +
          'deg) scale(1.02)'
      })
      card.addEventListener('mouseleave', function () {
        card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)'
      })
    })
  }

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
})()
