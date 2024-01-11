import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ACTIONS } from './VideoPlayer'
import { RootState } from './store'
import { Key } from "../lib/key.js"


type VideoAction = keyof typeof ACTIONS

export type VideoShortcut = [Key | null, VideoAction]
export type VideoShortcuts = VideoShortcut[]


const defaultVideoShortcuts: VideoShortcuts = [
  [{code: "Space"}, "play_pause"],
  [{code: "ArrowLeft"}, "previous_frame"],
  [{code: "ArrowRight"}, "next_frame"],
] as const

type Subject = string
export type SubjectShortcut = [Key | null, Subject]
export type SubjectShortcuts = SubjectShortcut[]

export type SubjectShortcutGroups = {
  name: string,
  shortcuts: SubjectShortcuts
}[]

const exampleSubjectShortcuts: SubjectShortcutGroups = [{
  name: "example",
  shortcuts: [
  [{code: "KeyA"}, "Subject A"],
  [{code: "KeyB"}, "Subject B"],
]}] as const

type Behaviour = string
export type BehaviourShortcut = [Key | null, Behaviour]
export type BehaviourShortcuts = BehaviourShortcut[]

export type BehaviourShortcutGroups = {
  name: string,
  shortcuts: BehaviourShortcuts
}[]

const exampleBehaviourShortcuts: BehaviourShortcutGroups = [{
  name: "example",
  shortcuts: [
  [{code: "KeyC", modifiers: ["shiftKey"]}, "Climbing"],
  [{code: "KeyD", modifiers: ["shiftKey"]}, "Diving"],
]}] as const

export type SettingsState = {
  videoShortcuts: VideoShortcuts
  subjectShortcutsGroups: BehaviourShortcutGroups
  behaviourShortcutsGroups: BehaviourShortcutGroups
}

export const settingsSlice = createSlice({
  name: "settings",
  initialState: {
    videoShortcuts: defaultVideoShortcuts,
    subjectShortcutsGroups: exampleSubjectShortcuts,
    behaviourShortcutsGroups: exampleBehaviourShortcuts,
  } as SettingsState,
  reducers: {
    settingsUpdated: (state, action: PayloadAction<SettingsState>) => {
      return action.payload
    }
  }
})


export default settingsSlice.reducer

export const {
  settingsUpdated,
} = settingsSlice.actions

export const selectSettings = (state: RootState) => state.settings
