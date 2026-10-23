// Bundled only by the loopback-only fixture server, never a Next application route.
import React from "react";
import {createRoot} from "react-dom/client";
import {LearningEmailCenter} from "../app/dashboard/admin/emails/workspace";
createRoot(document.getElementById("root")!).render(<><p style={{padding:12,background:"#fff3c4",color:"#3a2b00",margin:0}}>LOCAL TEST FIXTURE · fake accounts · no hosted data or email delivery</p><LearningEmailCenter/></>);
