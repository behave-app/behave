import { FunctionComponent } from "preact";
import { AppError, appErrorCleared } from "./appSlice";
import * as css from "./error.module.css"
import { useAppDispatch } from "./store";
import { ActionAlreadyInUseException, KeyAlreadyInUseException, ShortcutPresetExportFailedException, ShortcutPresetImportFailedException, ShortcutsState, SwitchLeadsToDuplicateKeysException, createOrUpdateShortcutKey, exportPreset, importPreset, nameFromStateKey, shortcutKeyRemoved } from "./shortcutsSlice";
import { CONTROLS, ValidControlName } from "./controls";
import { keyToStrings } from "../lib/key";
import { Dialog } from "../lib/Dialog";
import { exhausted } from "src/lib/util";

type ErrorHandlerProps<T> = {
  error: AppError & T
  closeError: () => void
}

function getTitle(shortcutStateKey: keyof ShortcutsState, action: string): string {
  if (shortcutStateKey === "generalShortcuts") {
    return CONTROLS[action as ValidControlName]?.description
  }
  return action
}

const KeyAlreadyInUseExceptionHandler: FunctionComponent<ErrorHandlerProps<KeyAlreadyInUseException>> = ({error, closeError}) => {
  const {callParams: {stateKey, action, newKey}, collidesWith} = error
  const title = getTitle(stateKey, action)
  const dispatch = useAppDispatch()
  return <div className={css.key_already_in_use}>
    <h2>Key already in use</h2>
    <div>
      This key is already in use as a shortcut {
        stateKey === "generalShortcuts"
          ? <>to <em>{title}</em>.</>
          : <>for the {stateKey === "subjectShortcuts"
            ? "subject" : "behaviour"} <em>{action}</em>.</>}
    </div>
    <div>
      Every key can only be assigned to a single action.
      Below you have a choice to either cancel the edit,
      or delete the other keybinding and reassign {
        keyToStrings(newKey).map(
          singleKey => <kbd>{singleKey}</kbd>)} to <em>{title}</em>.
    </div>
    <div className={css.button_row}>
      <button onClick={closeError}>Cancel</button>
      <button onClick={() => {
        dispatch(shortcutKeyRemoved({key: newKey, ...collidesWith}));
        closeError()
        void(dispatch(createOrUpdateShortcutKey(error.callParams)))
      }}>Reassign</button>
    </div>
  </div>
}

const ActionAlreadyInUseExceptionHandler: FunctionComponent<ErrorHandlerProps<ActionAlreadyInUseException>> = ({error, closeError}) => {
  const {callParams: {stateKey, newAction}} = error
  return <div className={css.action_already_in_use}>
    <h2>Action name already in use</h2>
    <div>
      There is already a {stateKey === "subjectShortcuts" ? "subject" : "behaviour"} shortcut with the name <em>{newAction}</em>
      It's not possible to make two shortcuts with the same content.
    </div>
    <div>
      Note that two names are compared in a case-insensitive way, and spaces at the start or end are ignored.
    </div>
    <div>
      Please change the name to a valid one.
    </div>
    <div className={css.button_row}>
      <button onClick={closeError}>close</button>
    </div>
  </div> 
}


const SwitchLeadsToDuplicateKeysExceptionHandler: FunctionComponent<ErrorHandlerProps<SwitchLeadsToDuplicateKeysException>> = ({error, closeError}) => {
  const {callParams} = error
  return <div className={css.switch_leads_to_duplicate_keys}>
    <h2>The change you're trying to make leads to duplicate key assignments</h2>
    <div>
      A single key-combination (e.g <kbd>Shift</kbd><kbd>Alt</kbd><kbd>A</kbd>)
      can only be assigned to a single action at any time.
      When changing the preset group for a section of shortcuts (e.g. the subject
      shortcuts), some of the key-combinations in the chosen preset group,
      may overlap with key-combinations in other sections.
    </div>
    <div>
      This situation can be solved by one of three ways:
      <ul>
        <li>Cancel the change (see button at the bottom)</li>
        <li>Change other preset groups, to a setting where there is no overlap</li>
        <li>For all overlapping key-combinations, choose which one you want to keep (the other one will be removed)</li>
      </ul>
      It is also possible to use a combination of the last two options.
    </div>
    <div>
      To avoid this situation in the future, it's best to always use the same
      keys for each of the sections; so for instance if you use
      <kbd>Shift</kbd><kbd>A</kbd> as a subject shortcut in one preset,
      never use it as a general shortcut or a behaviour shortcut in any presets.
    </div>
    {callParams.length}
    <div className={css.button_row}>
      <button onClick={closeError}>close</button>
    </div>
  </div> 
}

const ShortcutPresetExportFailedExceptionHandler: FunctionComponent<ErrorHandlerProps<ShortcutPresetExportFailedException>> = ({error, closeError}) => {
  const dispatch = useAppDispatch()
  return <div className={css.shortcut_preset_export_error}>
    <h2>Exporting of preset group failed</h2>
    <div>Please choose a proper location to save the export file</div>
    <div className={css.button_row}>
      <button onClick={() => {closeError(); void(dispatch(exportPreset(error.callParams)))}}>
        Try again
      </button>
      <button onClick={closeError}>
        Cancel
      </button>
    </div>
  </div>
}

const ShortcutPresetImportFailedExceptionHandler: FunctionComponent<ErrorHandlerProps<ShortcutPresetImportFailedException>> = ({error, closeError}) => {
  const dispatch = useAppDispatch()
  return <div className={css.shortcut_preset_import_error}>
    <h2>Importing of preset group failed</h2>
    {error.reason === "no file" ? <div>Please select a file to import</div>
      : error.reason === "corrupt"
        ? <div>It looks like the file is not a valid preset import file</div>
        : error.reason === "wrong section"
          ? <div>The preset file seems not to be for the {
            nameFromStateKey(error.callParams.stateKey).toLocaleLowerCase()
          } section</div>
          : exhausted(error.reason)
    }
    <div className={css.button_row}>
      <button onClick={() => {closeError(); void(dispatch(importPreset(error.callParams)))}}>
        Try again
      </button>
      <button onClick={closeError}>
        Cancel
      </button>
    </div>
  </div>
}

export const ErrorPopup: FunctionComponent<{error: AppError}> = ({error}) => {
  const dispatch = useAppDispatch()
  const closeError = () => {dispatch(appErrorCleared())}

  return <Dialog blur onRequestClose={closeError} type="error">
    {"error" in error && error.error === "KeyAlreadyInUseException"
      ? <KeyAlreadyInUseExceptionHandler {...{error, closeError}} />
      : "error" in error && error.error === "ActionAlreadyInUseException"
        ? <ActionAlreadyInUseExceptionHandler {...{error, closeError}} />
        : "error" in error && error.error === "SwitchLeadsToDuplicateKeysException"
          ? <SwitchLeadsToDuplicateKeysExceptionHandler {...{error, closeError}} />
          : "error" in error && error.error === "ShortcutPresetExportFailedException"
            ? <ShortcutPresetExportFailedExceptionHandler {...{error, closeError}} />
            : "error" in error && error.error === "ShortcutPresetImportFailedException"
              ? <ShortcutPresetImportFailedExceptionHandler {...{error, closeError}} />
              : <UnknownError error={error} closeError={closeError} />
    }
  </Dialog>
}

const UnknownError: FunctionComponent<ErrorHandlerProps<AppError>> = ({error, closeError}) => {
  const message = ("message" in error ? error.message : undefined) ?? `${error}`
  return <>
    <h2>Something went wrong</h2>
    <div>
      You should not see this screen, please report.
      <blockquote>{message}</blockquote>
    </div>
    <div className={css.button_row}>
      <button onClick={closeError}>close</button>
    </div>
  </>
}
