import React from "react";
import ReactDOM from "react-dom/client";
import ThreadCallPathVisualizer from "./app";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ThreadCallPathVisualizer />
	</React.StrictMode>,
);
