export const THREAD_LANGUAGE_ID = "thread-visualizer";

const configuredMonacos = new WeakSet<object>();

export function configureThreadLanguage(monaco: typeof import("monaco-editor")): void {
	if (configuredMonacos.has(monaco)) {
		return;
	}

	if (!monaco.languages.getLanguages().some((language) => language.id === THREAD_LANGUAGE_ID)) {
		monaco.languages.register({
			id: THREAD_LANGUAGE_ID,
			aliases: ["Thread Visualizer"],
		});
	}

	monaco.languages.setLanguageConfiguration(THREAD_LANGUAGE_ID, {
		comments: {
			lineComment: "#",
		},
	});

	configuredMonacos.add(monaco);
}
