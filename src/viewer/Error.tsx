import { FunctionComponent } from "preact";
import { AppError, MultipleActionsAssignedToPressedKeyException, appErrorCleared, selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut } from "./appSlice";
import * as css from "./error.module.css"
import * as generalcss from "./general.module.css"
import { useAppDispatch } from "./store";
import { ActionAlreadyInUseException, ShortcutPresetExportFailedException, ShortcutPresetImportFailedException, ShortcutsState, exportPreset, importPreset, nameFromStateKey, } from "./shortcutsSlice";
import { CONTROLS, ValidControlName } from "./controls";
import { keyToElements} from "../lib/key";
import { Dialog } from "../lib/Dialog";
import { exhausted, joinedStringFromDict } from "../lib/util";
import { executeShortcutAction } from "./reducers";
import { useSelector } from "react-redux";
import type { RootState } from "./store"
import { Icon } from "../lib/Icon";

type ErrorHandlerProps<T> = {
  error: AppError & T
  closeError: () => void
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
    <div className={generalcss.button_row}>
      <button onClick={closeError}>close</button>
    </div>
  </div> 
}


const ShortcutPresetExportFailedExceptionHandler: FunctionComponent<ErrorHandlerProps<ShortcutPresetExportFailedException>> = ({error, closeError}) => {
  const dispatch = useAppDispatch()
  return <div className={css.shortcut_preset_export_error}>
    <h2>Exporting of preset group failed</h2>
    <div>Please choose a proper location to save the export file</div>
    <div className={generalcss.button_row}>
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
    <div className={generalcss.button_row}>
      <button onClick={() => {closeError(); void(dispatch(importPreset(error.callParams)))}}>
        Try again
      </button>
      <button onClick={closeError}>
        Cancel
      </button>
    </div>
  </div>
}


const MAATPKButton: FunctionComponent<{shortcutsStateKey: keyof ShortcutsState, action: string}> = ({shortcutsStateKey, action}) => {
  const dispatch = useAppDispatch()
  const controlInfo = shortcutsStateKey === "generalShortcuts"
    ? CONTROLS[action as ValidControlName] : null

  const disabled = useSelector(
    shortcutsStateKey === "generalShortcuts" ? controlInfo!.selectIsDisabled
    : shortcutsStateKey === "subjectShortcuts"
    ? (state: RootState) => !selectIsWaitingForSubjectShortcut(state)
    : (state: RootState) => !selectIsWaitingForBehaviourShortcut(state))

  const activated = useSelector(controlInfo?.selectIsActivated ?? (() => false))

  return <button disabled={disabled}
    className={joinedStringFromDict({[css.activated]: activated})}
    onClick={() => dispatch(executeShortcutAction({shortcutsStateKey, action}))}>
    {nameFromStateKey(shortcutsStateKey)} <Icon iconName="arrow_right"
    /> {controlInfo?.description ?? action}
  </button>}


const MultipleActionsAssignedToPressedKeyExceptionHandler: FunctionComponent<ErrorHandlerProps<MultipleActionsAssignedToPressedKeyException>> = ({error, closeError}) => {

  return <div className={css.multiple_actions_assigned_to_pressed_key_exception}>
    <h2>Multiple actions assigned to this key</h2>
    <div>
    The key you pressed ({keyToElements(error.key)}) is bound to multiple actions.
    Choose the action you want.
    </div>
    <div>
      You will always see this screen if the key is bound to multiple actions,
      even if some of the actions are not possible at the time (e.g. a behaviour
      action is only possible to do after a subject has been selected).
      It is considered bad practice to have a single key bound to multiple
      actions, and you're adviced to fix this.
    </div>
    <div className={css.multiple_action_choices}>
      {error.actions.map(({shortcutsStateKey, action}) =>
        <MAATPKButton shortcutsStateKey={shortcutsStateKey} action={action} />)}
    </div>
    <div className={generalcss.button_row}>
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
    {error.error === "SerializedError"
      ? <UnknownError {...{error, closeError}} />
        : error.error === "ActionAlreadyInUseException"
          ? <ActionAlreadyInUseExceptionHandler {...{error, closeError}} />
          : error.error === "ShortcutPresetExportFailedException"
            ? <ShortcutPresetExportFailedExceptionHandler {...{error, closeError}} />
            : error.error === "ShortcutPresetImportFailedException"
              ? <ShortcutPresetImportFailedExceptionHandler {...{error, closeError}} />
              : error.error === "MultipleActionsAssignedToPressedKeyException"
                ? <MultipleActionsAssignedToPressedKeyExceptionHandler {...{error, closeError}} />
                : exhausted(error)
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
    <div className={generalcss.button_row}>
      <button onClick={closeError}>close</button>
    </div>
  </>
}
