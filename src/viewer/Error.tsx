import { FunctionComponent } from "preact";
import { AppError, MultipleActionsAssignedToPressedKeyException, appErrorCleared, selectIsWaitingForBehaviourShortcut, selectIsWaitingForSubjectShortcut } from "./appSlice";
import * as css from "./error.module.css"
import * as generalcss from "../lib/general.module.css"
import { useAppDispatch } from "./store";
import { ShortcutPresetExportFailedException, ShortcutPresetImportFailedException, ShortcutsState, exportPreset, importPreset, nameFromStateKey, } from "./shortcutsSlice";
import { CONTROLS, ValidControlName } from "./controls";
import { keyToElements} from "../lib/key";
import { Dialog } from "../lib/Dialog";
import { exhausted, joinedStringFromDict } from "../lib/util";
import { createNewBehaviourFileOrCreateWritable, executeShortcutAction } from "./reducers";
import { useSelector } from "react-redux";
import type { RootState } from "./store"
import { Icon } from "../lib/Icon";
import { BehaviourFileWriteException, NoWritableBehaviourFileException, triggerSaveRetry } from "./behaviourSlice";

type ErrorHandlerProps<T> = {
  error: AppError & T
  closeError: () => void
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
    {error.reason === "corrupt"
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


const MAATPKButton: FunctionComponent<{shortcutsStateKey: keyof ShortcutsState, action: string, closeError: () => void}> = ({shortcutsStateKey, action, closeError}) => {
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
    onClick={() => {closeError(); void(dispatch(executeShortcutAction({shortcutsStateKey, action})))}}>
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
        <MAATPKButton shortcutsStateKey={shortcutsStateKey} action={action} closeError={closeError}/>)}
    </div>
    <div className={generalcss.button_row}>
      <button onClick={closeError}>
        Cancel
      </button>
    </div>
  </div>
}

const NoWritableBehaviourFileExceptionHandler: FunctionComponent<ErrorHandlerProps<NoWritableBehaviourFileException>> = ({error, closeError}) => {
  const dispatch = useAppDispatch()

  return <div className={css.multiple_actions_assigned_to_pressed_key_exception}>
    <h2>{error.reason === "no file" ? "No behaviour file" : "Behaviour file is read only"}</h2>
    <div>
      In order to edit the behaviour file, you first have to {error.reason ===
        "read only" && "save a writable copy or "}create a new one.
    </div>
    <div className={generalcss.button_row}>
      <button onClick={() => dispatch(createNewBehaviourFileOrCreateWritable(
        {action: "create"})).unwrap().then(closeError)}>
        Create a new behaviour file
      </button>
      {error.reason === "read only" && <button
        onClick={() => dispatch(createNewBehaviourFileOrCreateWritable(
          {action: "make writable"})).unwrap().then(closeError)}>
        Save writable copy of current behaviour file
      </button>}
      <button onClick={closeError}>
        Cancel
      </button>
    </div>
  </div>
}

const BehaviourFileWriteExceptionHandler: FunctionComponent<ErrorHandlerProps<BehaviourFileWriteException>> = ({error, closeError}) => {
  const dispatch = useAppDispatch()

  return <div className={css.behaviour_file_write_error}>
    <h2>Behaviour file write error</h2>
    <div>
      BEHAVE was unable to write to the behaviour (.csv) file.
      One of the reasons may be that the harddisk is full.
    </div>
    <div>
      You can free some space and press "try again".
      If you press "close", beware that your latest changes to the behaviour file may not have been saved to disk (or in extreme cases, the behaviour file may be completely empty).
    </div>
    <details>
      <summary>Click here to see the (technical) error</summary>
      {error.reason}
    </details>
    <div className={generalcss.button_row}>
      <button onClick={() => {
        closeError();
        void(dispatch(triggerSaveRetry()))
      }}>
        Try again
      </button>
      <button onClick={closeError}>
        Close
      </button>
    </div>
  </div>
}

export const ErrorPopup: FunctionComponent<{error: AppError}> = ({error}) => {
  const dispatch = useAppDispatch()
  const closeError = () => {dispatch(appErrorCleared())}

  return <Dialog blur onRequestClose={closeError} type="error">{(() => {
    switch (error.error) {
      case "SerializedError":
        return <UnknownError {...{error, closeError}} />
      case "ShortcutPresetExportFailedException":
        return <ShortcutPresetExportFailedExceptionHandler {...{error, closeError}} />
      case "ShortcutPresetImportFailedException":
        return <ShortcutPresetImportFailedExceptionHandler {...{error, closeError}} />
      case "MultipleActionsAssignedToPressedKeyException":
        return <MultipleActionsAssignedToPressedKeyExceptionHandler {...{error, closeError}} />
      case "NoWritableBehaviourFileException":
        return <NoWritableBehaviourFileExceptionHandler {...{error, closeError}} />
      case "BehaviourFileWriteException":
        return <BehaviourFileWriteExceptionHandler {...{error, closeError}} />
      default:
        exhausted(error)
    }})()}
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
