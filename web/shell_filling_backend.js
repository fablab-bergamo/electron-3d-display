/* Load the existing Python physics module directly; no duplicated exception
 * table or separately generated configuration catalog is maintained here. */
const ShellFillingBackend = {
    async load() {
        const runtime = await loadPyodide();
        runtime.FS.mkdirTree('/lesson');
        await Promise.all(['slater.py', 'slater_cr_zeff.py'].map(async name => {
            const response = await fetch(`../micropython/${name}`);
            if (!response.ok) throw new Error(`Physics model: HTTP ${response.status}`);
            runtime.FS.writeFile(`/lesson/${name}`, await response.text());
        }));
        runtime.runPython("import sys, json\nsys.path.insert(0, '/lesson')\nimport slater\ndef lesson_configuration(z):\n    return json.dumps(slater.electron_configuration(z))");
        const slater = runtime.globals.get('slater');
        const configuration = runtime.globals.get('lesson_configuration');
        ShellFilling.useReference({
            configuration: z => JSON.parse(configuration(z)),
            symbol: z => slater.element_symbol(z),
            nameItalian: z => slater.element_name_it(z),
        });
    },
};
