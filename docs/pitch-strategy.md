# iTECify — Strategie de Pitch (6 Minute)

---

## 0:00–0:30 — Hook (cu propriile lor cuvinte)

> "Enunțul problemei începe cu o scenă: ora 3 dimineața. Ana scrie Python, Radu face tweak-uri în React, un agent AI generează rutele de backend — totul în același fișier, fără conflicte de Git. Voi ați scris scena asta. Noi am construit-o."

Deschideți aplicația live. Fără slide-uri. Interfața este pitch-ul.

---

## 0:30–1:00 — Problema

Câte o propoziție pentru fiecare problemă menționată în PDF:

- Copilot = autocompletare pe steroizi. Nu un colaborator real.
- Nu poți distinge codul uman de o halucinație AI — debugging-ul devine un coșmar.
- Platformele de sandboxing pică când vine vorba de backend complex.
- Deployment-ul îți rupe complet fluxul de lucru.

> "Le-am rezolvat pe toate patru."

---

## 1:00–2:30 — Demo 1: Colaborare (cerința #1)

**Arată:** Două ferestre de browser side by side, aceeași sesiune.

1. Scrie în prima fereastră → Yjs CRDT sincronizează poziția cursorului și editările în timp real în cealaltă fereastră. Subliniază: *"Niciun Git push, niciun conflict."*
2. Deschide VibeChat, trimite un prompt agentului AI. Urmărește cum răspunsul apare token cu token.
3. Când agentul apelează `write_file`, editorul Monaco afișează **blocul accept/reject** — diff verde inline, două butoane. Apasă Accept.
4. Subliniază: *"Codul uman arată normal. Codul AI e un bloc Notion. Un singur click pentru a-l accepta sau refuza. Exact asta ați cerut."*

**Acoperă:** Multi-cursor, sincronizare CRDT, AI block-editor, accept/reject.

---

## 2:30–3:30 — Demo 2: Sandboxing + Securitate (cerința #2)

**Arată:** Alege un fișier Python sau Rust. Apasă Run.

1. Terminalul afișează live stdout/stderr în timp ce containerul Docker execută codul. Spune: *"Container Docker izolat, pornit din mers, pentru orice limbaj."*
2. Deschide **Security Scan** — declanșează-l pe un fișier cu un secret hardcodat sau un pattern de SQL injection. Arată vulnerabilitățile detectate înainte de execuție.
3. Opțional: menționează limitele de CPU și memorie aplicate pe container.

**Acoperă:** Docker sandboxing, output live, scanare de vulnerabilități pre-execuție, resource limits.

---

## 3:30–4:15 — Demo 3: Terminal Comun (Side-quest #1)

**Arată:** Deschide terminalul în ambele ferestre.

1. Scrie o comandă într-o fereastră — ambele văd output-ul simultan.
2. Spune: *"Nu doar editorul e colaborativ. Și terminalul e."*

Scurt — maxim 45 de secunde. E un side-quest, tratează-l ca atare.

---

## 4:15–5:00 — Demo 4: Time-Travel Debugging (Side-quest #2)

**Arată:** Bara de timeline din workspace.

1. Navighează înapoi prin 3-4 checkpoint-uri. Arată diff-ul pentru fiecare.
2. Restaurează o stare anterioară. Spune: *"Fiecare acțiune AI creează un checkpoint. Dai rewind sesiunii ca la un replay."*

Folosește exact expresia "Time-Travel Debugging" — e termenul lor din PDF.

---

## 5:00–5:30 — Easter Eggs (rapid, cu energie)

Mergi rapid, menține energia sus:

1. **Rubber Duck** — *"Blocat? Vorbește cu rățușca."*
2. **Matrix Rain** — declanșează-l. *"Pentru că de ce nu."*
3. **Pomodoro Timer** — *"Ne pasă de burnout."*
4. **Subway Surfer 3D / Spotify** — *"Energie de hackathon la 3 dimineața, inclusă în platformă."*
5. **CoderMatch** — *"Tinder pentru găsit un pair programmer."*
6. **Code Roast** — *"Cere-i AI-ului să-ți roasteze codul. O va face."*

Un singur liner per easter egg — arată, nu explica.

---

## 5:30–6:00 — Închidere

> "Ați cerut Figma, dar pentru cod. Multi-human, multi-AI, o singură fereastră, fără conflicte, rulează orice, scanează vulnerabilități înainte de execuție și deployează când ești gata. Asta e iTECify."

Dacă feature-ul de deploy e funcțional — deployează ceva live chiar acum, ca ultimul beat. Nimic nu închide un demo mai bine decât să shipi în fața juriului.

---

## Rezumat timing

| Segment | Durată | Criterii acoperite |
|---|---|---|
| Hook | 0:30 | Implicare |
| Problema | 0:30 | Context |
| Demo Colaborare | 1:30 | Obligatoriu: CRDT, AI blocks |
| Demo Sandboxing + Securitate | 1:00 | Obligatoriu: Docker, scanare |
| Terminal Comun | 0:45 | Side-quest |
| Timeline / Time-travel | 0:45 | Side-quest |
| Easter eggs | 0:30 | Bonus |
| Închidere | 0:30 | Impact |

---

**O singură regulă:** nu ieși niciodată din aplicație. Fiecare tranziție trebuie să fie un click în interfață, nu un slide. Interfața e densă și impresionantă — lasă-o să vorbească.
