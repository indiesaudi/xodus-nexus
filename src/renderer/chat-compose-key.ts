import type {KeyboardEvent} from 'react';
/** Submit plain Enter once; preserve newlines, desktop shortcuts and IME composition. */
export function chatComposeKey(event:KeyboardEvent<HTMLTextAreaElement>):void{
 if(event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey||event.nativeEvent.isComposing||event.nativeEvent.keyCode===229)return;
 event.preventDefault();
 if(!event.repeat)event.currentTarget.form?.requestSubmit();
}
