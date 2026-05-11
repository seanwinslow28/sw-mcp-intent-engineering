**⏺ All six files read. Outputting the implementation plan now, then stopping.**                                                           
                                                                                                     
  **\---**                                                                                                                                  
  ***Phase 0 — Implementation Plan***                                                                                                        
                                                                                                                                       
  **Conflict policy applied: scope-lock wins; on research-doc disagreement, ChatGPT's stable-v1 stance wins (per scope-lock §2**           
  **footnote).**                                                                                                                           
                                                                                                      
  **1\. SDK \+ runtime**                                                                                                                     
                                                                                                      
  **\- @modelcontextprotocol/sdk@1.29.0 (exact, stable v1.x), Node \>=20, "type": "module" (ESM), build via tsc && chmod 755**               
  **build/index.js. zod ^3.25.0. (scope-lock §2 table; ChatGPT §1 stable-vs-pre-alpha; Gemini DR Max §1)**  
  **\- Note conflict: Gemini DR Max §1 references tsx for dev. Skipping — scope-lock §2 only specifies tsc build \+ node start.**            
                                                                                                                                       
  **2\. Transport choice \+ isolation**       
                                                                                                                                       
  **\- StdioServerTransport only. SSE deprecated; Streamable HTTP deferred. (scope-lock §2; ChatGPT §3 transport matrix; Gemini DR Max**    
  **§3)**                                   
  **\- Isolation rule: src/index.ts is the only file that imports @modelcontextprotocol/sdk/server/stdio.js and calls**                     
  **server.connect(transport). Tool registration is also there but only as thin adapter calls into src/intent/\*. A future Streamable**     
  **HTTP swap edits only src/index.ts. (Gemini DR Max §3 \+ §4 "MarkItDown wrapper paradigm"; ChatGPT §3 "Keep transport code isolated**  
  **in one file")**                                                                                                                        
                                                                                                      
  **3\. Project layout**                     
  **Per scope-lock §2 (locked):**                                                                                                          
  **src/index.ts                  \# McpServer \+ transport \+ thin tool registration**  
  **src/intent/audit.ts           \# Tool 1 logic**                                                                                         
  **src/intent/scaffold.ts        \# Tool 2 logic**                                                                                         
  **src/intent/retrofit.ts        \# Tool 3 logic**  
  **src/intent/checklist.ts       \# 40-item validation checklist (typed const array)**                                                     
  **src/intent/anti-patterns.ts   \# 5 fatal anti-pattern detector functions**                                                              
  **src/intent/parser.ts          \# YAML-frontmatter \+ Markdown-heading permissive parser**                                                
  **src/intent/templates/**                                                                                                                
    **blank.ts                    \# 9-section blank scaffold (TS string const)**                                                           
    **level-1-mvr.ts              \# 3-section MVR scaffold (TS string const)**                                                             
    **full-9-section.ts           \# full template with prompts (TS string const)**                                                         
  **TS string constants, not file reads at runtime — simpler bin-published binary. (scope-lock §5 "Implementation notes")**                
                                                                                                                                       
  **4\. Tool 1 — audit\_intent\_spec**                                                                                                        
                                                                                                                                       
  **\- Parsing strategy (scope-lock §10.7 \+ §4 "Implementation notes"): parser.ts accepts either YAML frontmatter (delimited by \---) OR**   
  **Markdown headings (\#\# Objective, \#\# Desired Outcomes, etc.). YAML wins when both present. Permissive fallback: if no \#\# Objective**  
  **heading, first paragraph treated as objective.**                                                                                       
  **\- Pagination (scope-lock §4 \+ Gemini DR Max §4 fetch-server pattern): start\_index \+ max\_length (defaults 0 / 10000, max 20000).**  
  **Slice input \[start\_index, start\_index+max\_length\], run checklist \+ anti-patterns on the chunk only. If chunk end \< input length,**     
  **set next\_chunk\_token \= String(start\_index \+ max\_length). Score reported per-chunk; LLM aggregates across calls. Per-chunk**  
  **anti-pattern detection means flags accumulate as client paginates.**                                                                   
  **\- 5 anti-pattern detectors sourced verbatim from SKILL.md "The 5 Fatal Anti-Patterns": each is (parsed: ParsedSpec) \=\> boolean.**  
  **Klarna (no health metric paired with primary outcome), prompt-based-hard-constraints (presence of "never X" / "must X" in prose**      
  **without architectural enforcement marker), activity-vs-outcome (verb-led outcomes vs. state-led), vibe-coded-edge-cases (\<5**  
  **enumerated edge cases or none), missing-stop-rules (no halt/escalate/complete present).**                                              
                                                                                                      
  **5\. Tool 2 — generate\_intent\_spec\_scaffold**                                                                                            
     
  **\- Three template variants live as TS string constants in src/intent/templates/\*.ts. blank.ts and full-9-section.ts derived from**      
  **references/intent-spec-template.md Blank Template (the 9-section YAML block). level-1-mvr.ts derived from SKILL.md "Minimum Viable**  
  **Retrofit (MVR) Guide → Level 1: Minimum Viable Intent (30 min per skill)" — the 3 sections (Objective, Desired Outcomes, Stop**        
  **Rules).**                                                                                             
  **\- objective\_hint interpolated as the start of the objective field, leaving the trade-off clause "When facing trade-offs, prioritize**  
   **\[PRIMARY VALUE\] over \[SECONDARY VALUE\]" as a placeholder. (scope-lock §5 "Implementation notes")**                                    
  **\- autonomy\_level selects Decision Authority block per SKILL.md "Autonomy Levels" table (4 patterns): full-autonomous → acceptEdits**  
  **\+ allowed\_tools whitelist; guarded-autonomous → record\_run() \+ lower max\_budget\_usd \+ rollback; proposal-first → interactive**         
  **permission flow; human-required → disallowedTools: \[Write, Edit, Bash\] deny-list. Map applies only to kind: "full-9-section".**  
  **(scope-lock §5 \+ SKILL.md "Architecture mapping")**                                                                                    
  **\- next\_steps heuristically generated by which placeholders remain. If objective\_hint is provided, first step shifts from "fill**  
  **objective" to "complete trade-off clause."**                                                                                           
     
  **6\. Tool 3 — assess\_retrofit\_level**                                                                                                    
                                                                                                      
  **Heuristic per SKILL.md "Prioritization for 107 Skills" \+ scope-lock §6 "Implementation notes":**                                       
  **\- Section-count signal: count of present 9-section blocks (parsed by parser.ts).**                    
  **\- Blast-radius signals raise it: filesystem write language (fs.write, Edit, Write tool refs), network/API invocation (fetch, curl,**   
  **https, api, external service names), credential or secret references.**                                                               
  **\- Complexity signals raise it: loop / scheduled / autonomous / launchd / cron keywords → complexity: "autonomous-loop". Multiple**     
  **distinct directives or \>800 words → multi-step. Single-task fits in \<300 words → single-step.**                                     
  **\- Decision matrix: L1-mvr \= single-step \+ low blast \+ interactive (assume proposal-first). L2-structured \= multi-step \+ medium**       
  **blast OR autonomous \+ low blast. L3-full \= autonomous-loop \+ medium/high blast OR existing skill already has 5+ sections present**  
  **(worth full conversion). estimated\_time derived: L1 \= "30 min", L2 \= "2–4 hours", L3 \= "4–8 hours" (matches SKILL.md MVR Guide).**     
                                                                                                      
  **7\. Schema validation**                                                                                                                 
                                                                                                      
  **\- Zod object schemas exported from each tool's module. Inputs registered through SDK's registerTool — relying on Standard Schema →**   
  **JSON Schema conversion. (Gemini DR Max §2)**  
  **\- XOR refinement for spec\_text vs file\_path per scope-lock §4 \+ §6 (verbatim Zod):**                                                   
  **z.object({...}).refine(**                                                                                                              
    **({ spec\_text, file\_path }) \=\> Boolean(spec\_text) \!== Boolean(file\_path),**                                                           
    **{ message: "Provide exactly one of spec\_text OR file\_path." }**                                                                      
  **)**                                                                                                                                    
  **\- ChatGPT §2 flags that v1 registerTool ergonomics for refined-object schemas may need verification. Mitigation: also re-validate**    
  **XOR inside the handler as the first step before file I/O — belt-and-suspenders. If registerTool rejects the refined schema at**        
  **registration, fall back to a flat schema \+ handler-side XOR check.**                                  
                                                                                                                                       
  **8\. Error handling model**                                                                             
                                        
  **\- Schema-shape errors → protocol-level. Wrong types, missing required field, both spec\_text and file\_path populated → let the SDK**    
  **reject with JSON-RPC error. Do not catch. (Gemini DR Max §2; ChatGPT §2 \+ spec evidence)**  
  **\- Runtime errors → tool result with isError: true. File-not-found, unreadable file, parse failure on YAML, oversize input post-trim**  
   **→ return { isError: true, content: \[{ type: "text", text: "\<short message\>" }\] }. Wrap each tool's execution in try/catch. (Gemini**  
   **DR Max §2; scope-lock §9 hard rule)**  
  **\- console.log is forbidden because stdio's stdout is the protocol channel; any stray write corrupts JSON-RPC framing → silent**        
  **disconnect or Unexpected end of JSON input. All diagnostic logs go to console.error (stderr). (Gemini DR Max §6 anti-pattern \#1;**     
  **ChatGPT §6 "stdout corruption is the \#1 bug"; scope-lock §2 \+ §9)**  
                                                                                                                                       
  **9\. Registry path**                                                                                    
                                        
  **\- Namespace: com.seanwinslow/intent-engineering (domain-verified via DNS TXT on seanwinslow.com). NOT io.github.seanwinslow28/\* —**    
  **domain-form is cleaner and avoids the trailing-28 brand inconsistency. (scope-lock §10.3 \+ §2 table)**  
  **\- npm publish first (@swinslow/intent-engineering-mcp, fallback @swins), then mcp-publisher flow: mcp-publisher init → produces DNS**  
   **TXT token → user adds TXT record on seanwinslow.com → wait for propagation → mcp-publisher login (domain auth path) →**               
  **mcp-publisher publish. (scope-lock §10.3; ChatGPT §5 registry process; Gemini DR Max §5)**  
                                                                                                                                       
  **10\. Days 1–3 task breakdown (Phase 1 commits)**                                                                                        
                                        
  **Per Gemini DR Max §7 Phase 1:**                                                                                                        
  **1\. Day 1 commit: npm init \-y, edit package.json (name @swinslow/intent-engineering-mcp, version 0.1.0, type module, engines node**  
  **≥20, bin entry, scripts, files: \["build"\], MIT license). Install @modelcontextprotocol/sdk@1.29.0 \+ zod@^3.25.0 \+ devDeps**            
  **typescript@^5.0.0 \+ @types/node@^22.0.0. Write tsconfig.json (target ES2022, module Node16, moduleResolution Node16, strict, outDir**  
   **./build, rootDir ./src). Write LICENSE (MIT, Sean Winslow, 2026). Write .gitignore (node\_modules, build, \*.log, .DS\_Store).**         
  **2\. Day 2 commit: Write src/index.ts — McpServer instantiation (name intent-engineering, version 0.1.0), one dummy ping tool**   
  **registered via registerTool (returns static text), StdioServerTransport connected. console.error-only logging.**               
  **3\. Day 3 commit (single squash) — chore: scaffold project per docs/v0-scope.md §2 (Phase 1): npm run build succeeds and produces**     
  **build/index.js. Output absolute path \+ claude\_desktop\_config.json snippet \+ macOS Claude Desktop full-restart instructions. Wait**  
  **for Sean's "Phase 1 verified" confirmation.**                                                                                          
                                                                                                      
  **\---**                                                                                                                                  
  **STOP. Awaiting your review. No code written. No commands run. No repo files modified. Reply with explicit "approved — proceed with**  
  **Phase 1" (or change requests) before I begin scaffolding.**          
