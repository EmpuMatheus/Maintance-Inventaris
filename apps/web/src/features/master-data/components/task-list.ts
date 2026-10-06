export interface TaskRow {
  /** Local React key, never sent to the backend. */
  key: string;
  /** Present for tasks that already exist in the database. */
  id?: string;
  task: string;
}

let tempCounter = 0;

export function makeTaskRow(task = '', id?: string): TaskRow {
  tempCounter += 1;
  return { key: id ?? `new-${tempCounter}`, id, task };
}
