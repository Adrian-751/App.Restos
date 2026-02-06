import mongoose from 'mongoose'

const appStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, default: '' },
  },
  { timestamps: true }
)

export const getAppStateModel = (conn) =>
  conn.models.AppState || conn.model('AppState', appStateSchema)

export default mongoose.model('AppState', appStateSchema)

