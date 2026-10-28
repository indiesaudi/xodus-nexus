import {it,expect,vi} from 'vitest';
import type {KeyboardEvent} from 'react';
import {chatComposeKey} from './chat-compose-key';
function press(patch:object={}){const submit=vi.fn(),prevent=vi.fn();chatComposeKey({key:'Enter',nativeEvent:{},currentTarget:{form:{requestSubmit:submit}},preventDefault:prevent,...patch} as unknown as KeyboardEvent<HTMLTextAreaElement>);return{submit,prevent};}
it('sends plain Enter through the real form submission path',()=>{const f=press();expect(f.submit).toHaveBeenCalledOnce();expect(f.prevent).toHaveBeenCalledOnce();});
it.each([{shiftKey:true},{ctrlKey:true},{altKey:true},{metaKey:true},{key:'a'},{nativeEvent:{isComposing:true}},{nativeEvent:{keyCode:229}}])('preserves multiline input, modifiers and composing input: %j',patch=>{const f=press(patch);expect(f.submit).not.toHaveBeenCalled();expect(f.prevent).not.toHaveBeenCalled();});
it('does not duplicate sends on key repeat',()=>{const f=press({repeat:true});expect(f.submit).not.toHaveBeenCalled();expect(f.prevent).toHaveBeenCalledOnce();});
