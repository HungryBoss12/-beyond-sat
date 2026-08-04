# Beyond SAT — Master Platform Architecture & Implementation Spec

## Core Objective
Transform "Beyond SAT" into an award-winning, ambient 3D SaaS platform (inspired by Apple product landings, Stripe WebGL design, and Spline 3D scroll web experiences). The build includes interactive 3D elements, ambient scroll mechanics, universal cursor-aware lighting, a multi-model OpenRouter "Beyond AI" engine, and full admin site controls (API management + Maintenance Mode).

---

## 1. Landing Page: Ambient Scrollytelling & 3D WebGL Canvas
* **Visual Benchmarks:** Modern 3D scrollytelling aesthetic (similar to ieltsone.com, Spline.design showcases, and Apple product pages).
* **3D Model Integration (Spline / Three.js):**
  * **Hero Viewport:** Embed an interactive 3D canvas (using `@splinetool/react-spline` or Three.js) featuring an illuminated 3D "Beyond AI" core/emblem.
  * **Scroll-Driven Animation:** Tie the 3D scene camera and object rotation directly to scroll position (via Spline Scroll Events or GSAP ScrollTrigger), seamlessly transitioning through distinct states as the user scrolls.
  * **Mobile Optimization:** Automatically downscale WebGL shadow quality or fall back to smooth touch-friendly CSS/canvas transitions on mobile screens.
* **Ambient Mouse FX:**
  * **Cursor-Tracking Spotlight Glow:** Add a radial ambient glow spotlight in the background that follows mouse coordinates `(x, y)` across the viewport (`mix-blend-mode: screen`, `pointer-events: none`).
* **Scrollytelling Content Sections:** Dynamically reveal landing sections on scroll:
  1. Hero Value Proposition & 3D Emblem
  2. Interactive "Beyond AI" Step-by-Step Problem Breakdown Demo
  3. Digital SAT Prep Programs (Math, Reading/Writing, Full Practice Tests)
  4. Student Reviews & Social Proof Badges
  5. Pricing & Feature Comparison Tabs

---

## 2. Universal UI System: Cursor-Aware Hover Effect (Reveal Highlight)
* **Application Scope:** Apply a Fluent-style **Cursor-Aware Reveal Effect** across all cards, sidebar navigation items, quiz containers, and dashboard blocks (Landing, Main Menu, Dashboard, Diagnostic Analytics).
* **Behavior:**
  * Detect cursor `(x, y)` coordinates relative to the active block bounding box.
  * Dynamically illuminate the card's border and background gradient underneath the cursor pointer.

---

## 3. "Beyond AI" Feature Suite

### A. Landing Page Showcase
* Hero Callout: *"Driven by Beyond AI — Your Personal 1-on-1 Digital SAT Coach."*
* Interactive preview container demonstrating Beyond AI explaining a complex SAT math/reading problem step-by-step.

### B. Student Dashboard Integration
* **Dynamic Score Widget:** Card displaying current estimated SAT score (e.g., 1380/1600) with subtle 3D hover depth.
* **AI Action Recommendations:** Automated recommendations (e.g., *"Beyond AI recommends focusing on Advanced Algebra today to gain +40 pts"*).

### C. Specialized AI Analysis Workspace (`/analysis`)
* Interactive diagnostic chat interface for reviewing student test performance.
* Key Features:
  * "Which topic should I work on first?" quick action button.
  * Step-by-step math breakdowns using LaTeX formatting ($x^2$, $\frac{a}{b}$, $\sqrt{x}$).
  * Interactive prompt history allowing students to chat directly about missed questions.

---

## 4. Admin Panel & Controls (`/admin/settings`)

### A. OpenRouter API & Multi-Model Mapping Settings
* **API Key Input:** Secure field for admins to enter/update the platform OpenRouter API Key.
* **Model Router Configurator:** UI inputs allowing admins to assign specific OpenRouter Model IDs to internal tasks:
  * **Fast Chat & Quiz Generation:** `nvidia/nemotron-3-super-120b-a12b:free` or `inclusionai/ling-3.0-flash:free`
  * **Deep Diagnostics & Reasoning:** `deepseek/deepseek-r1:free` or `nvidia/nemotron-3-ultra-550b-a55b:free`
  * **Multimodal / Geometry Vision:** `google/gemini-2.0-flash-001`

### B. Global Maintenance Mode Switch
* **Toggle Control:** ON/OFF switch in the Admin Panel.
* **Custom Maintenance Message:** Editable text field for visitor announcements (e.g., *"Beyond SAT is undergoing scheduled updates to prepare for the upcoming Digital SAT test date."*).
* **Admin Session Bypass:** Authenticated admins retain full access to test the live site while Maintenance Mode is active for public traffic.

---

## 5. Backend Architecture & Multi-Model Routing Rules (Cloudflare Workers)

### A. Intelligent Task-Based AI Router (`/api/ai/chat`)
Create a central AI proxy endpoint in Cloudflare Workers that inspects the request type and automatically dispatches it to the correct OpenRouter model:
1. **Route 1: General Chat, Live Tutor & JSON Quiz Generation** 
   * Handled by: `Nemotron 3 Super` / `Ling 3.0 Flash`
   * Reason: High token throughput, low latency, structured JSON output.
2. **Route 2: Deep Diagnostics & Step-by-Step Math Breakdown (`/analysis`)** 
   * Handled by: `DeepSeek-R1` / `Nemotron 3 Ultra`
   * Reason: Heavy Chain-of-Thought (CoT) reasoning for hard algebra/geometry solutions.
3. **Route 3: Vision / Geometry Diagrams & Graphs** 
   * Handled by: `Gemini 2.0 Flash`
   * Reason: Native computer vision for processing chart screenshots and geometry figures.

### B. Universal System Rules & Guardrails
Inject these rules into **EVERY** model call across all routes:
1. **Unified Identity:**
   > *"You are Beyond AI, the dedicated AI SAT Tutor for Beyond SAT. Maintain an encouraging, clear, and structured tone for high school students. Never reveal backend provider names (Llama, Gemini, Nemotron, DeepSeek, OpenAI). If asked who created you, identify strictly as Beyond AI."*
2. **Domain Guardrail:**
   > *"You strictly answer questions related to the Digital SAT, high school mathematics, reading comprehension, grammar, and test strategy. Politely decline non-academic prompts and redirect the user back to their test goals."*
3. **LaTeX Standard:** Always render math formulas using standard inline `$formula$` or block `$$formula$$` syntax.

### C. Maintenance Mode Middleware
* Intercept all non-admin routes when Maintenance Mode is enabled in KV storage and return a sleek dark 503 Maintenance Page matching the dark SaaS aesthetic.