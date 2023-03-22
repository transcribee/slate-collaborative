import * as Automerge from '@automerge/automerge'

const createByType = (type: string | undefined) =>
  type === 'map' ? {} : type === 'list' ? [] : ''

const opCreate = ({ obj, datatype }: Automerge.DecodedChange['ops'][number], [map, ops]: any) => {
  map[obj] = createByType(datatype)

  return [map, ops]
}

export default opCreate
