***Phase 1 — Complete. Awaiting verification.***                                                                          
                                                                                                       
  **Commit:** 24e4047 — chore: scaffold project per docs/v0-scope.md §2 (Phase 1\)  
  **Files committed:** 7 (package.json, package-lock.json, tsconfig.json, LICENSE, .gitignore, docs/v0-scope.md,          
  src/index.ts)                                           
  **SDK pinned at:** @modelcontextprotocol/sdk@1.29.0 (verified in node\_modules)                                          
  **Build:** npm run build → build/index.js (mode 755, 818 bytes, executable)                              
  **Smoke test:** MCP initialize handshake returned a valid JSON-RPC response on stdout; startup log appeared only on     
  stderr. No stdio corruption.                            
                                                                                                                      
  **Absolute path to the binary**                                                                                         
                                                                                                                      
  /Users/seanwinslow/Code-Brain/sw-mcp-intent-engineering/build/index.js                                              
                                                                                                                      
  **Claude Desktop config**                                                                                               
                                                                                                                      
  The macOS config file lives at:                                                                                     
  \~/Library/Application Support/Claude/claude\_desktop\_config.json                                                     
                                                                                                                      
  Paste this snippet (or merge it into your existing mcpServers block):                                               
                                                                                                                      
  {                                                                                                                   
    "mcpServers": {                                                                                                   
      "intent-engineering": {                                                                                         
        "command": "node",              
        "args": \[                                                                                                     
          "/Users/seanwinslow/Code-Brain/sw-mcp-intent-engineering/build/index.js"                     
        \]                                                                                                             
      }  
    }                                                                                                                 
  }                                                                                                    
                                        
  **macOS** **restart** **sequence**  
  1\. Open the config in your editor: open \-a TextEdit "$HOME/Library/Application                                      
  Support/Claude/claude\_desktop\_config.json" (or mkdir \-p "$HOME/Library/Application Support/Claude" && touch   
  "$HOME/Library/Application Support/Claude/claude\_desktop\_config.json" first if the file doesn't exist yet).         
  2\. Paste/merge the snippet above. Save.                                                              
  3\. **Fully quit** Claude Desktop with Cmd+Q. Closing the window is not enough — the SDK docs are explicit: the daemon   
  keeps running and won't pick up the config until full quit. (Gemini DR Max §5; ChatGPT §5)                          
  4\. Reopen Claude Desktop.                                                                                           
  5\. In a chat, type something like "use the ping tool" or check the tools/MCP indicator in the UI. The server        
  should list intent-engineering with one tool: ping. Calling it should return pong.                                  
                                                                                                                      
  **If something goes sideways**                                                                                          
                                                                                                       
  \- **Server doesn't appear at all** → check \~/Library/Logs/Claude/mcp\*.log. Most common cause is a path typo in the      
  config or a stale Claude Desktop process (pkill \-f "Claude Desktop" and reopen).  
  \- **Server appears but errors on connect** → run node                                                                   
  /Users/seanwinslow/Code-Brain/sw-mcp-intent-engineering/build/index.js \< /dev/null in a terminal — should print     
  "intent-engineering MCP server running on stdio" to stderr and then sit waiting. Ctrl+C to exit.  
  \- **JSON parse errors in the log** → would indicate a console.log slipped into stdout. Phase 1 has been smoke-tested    
  and is clean, but Phase 2 will add a CI grep guard regardless.                                                      
                                        
  \---                                                                                                                 
  **STOP.** Once you've added the config, restarted Claude Desktop, and confirmed the ping tool returns pong, reply with  
   **"Phase 1 verified"** and I'll begin Phase 2 (the three real tools). If the ping fails, paste the relevant log lines  
   and I'll debug before advancing.  
                                                                                                                      
✻ Cogitated for 6m 10s                                                                                 
                                                                                            
※ **recap:** *Building the intent-engineering MCP server v0 (3 tools, ship 5/25). Phase 1 scaffold is committed (commit*    
  *24e4047) and smoke-tested; next action is for you to paste the config snippet into Claude Desktop, fully quit and*   
  *reopen, then confirm the ping tool returns pong. (disable recaps in /config)*                                        
                                                                                                          
