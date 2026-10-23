export type SubmitFormOptions = {
    readonly url : string,
    // The window name to submit into: a popup's or iframe's `name`.
    readonly target : string,
    readonly method ?: 'get' | 'post',
    readonly body ?: Readonly<Record<string, string | boolean>>,
};

// Navigate a named window by submitting a form into it, which is the only
// way to send a POST to another window.
export const submitForm = ({ url, target, method = 'post', body = {} } : SubmitFormOptions) : void => {
    const form = document.createElement('form');

    form.setAttribute('target', target);
    form.setAttribute('action', url);
    form.setAttribute('method', method);
    form.style.display = 'none';

    for (const [ key, value ] of Object.entries(body)) {
        const input = document.createElement('input');

        input.setAttribute('type', 'hidden');
        input.setAttribute('name', key);
        input.setAttribute('value', String(value));
        form.append(input);
    }

    document.body.append(form);
    form.submit();
    form.remove();
};
