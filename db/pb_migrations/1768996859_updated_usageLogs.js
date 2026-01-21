/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_47371311")

  // remove field
  collection.fields.removeById("text2783163181")

  // remove field
  collection.fields.removeById("text1542800728")

  // remove field
  collection.fields.removeById("text650664106")

  // remove field
  collection.fields.removeById("text3801414005")

  // remove field
  collection.fields.removeById("text3779201023")

  // remove field
  collection.fields.removeById("text2254405824")

  // add field
  collection.fields.addAt(1, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_2047001084",
    "hidden": false,
    "id": "relation2897713717",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "guest",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "number650664106",
    "max": null,
    "min": null,
    "name": "tokenInput",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "number3801414005",
    "max": null,
    "min": null,
    "name": "tokenOutput",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "number3635897889",
    "max": null,
    "min": null,
    "name": "firstTokenLatency",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "number2254405824",
    "max": null,
    "min": null,
    "name": "duration",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_47371311")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2783163181",
    "max": 0,
    "min": 0,
    "name": "ip",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1542800728",
    "max": 0,
    "min": 0,
    "name": "field",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text650664106",
    "max": 0,
    "min": 0,
    "name": "tokenInput",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3801414005",
    "max": 0,
    "min": 0,
    "name": "tokenOutput",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3779201023",
    "max": 0,
    "min": 0,
    "name": "firstLatency",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2254405824",
    "max": 0,
    "min": 0,
    "name": "duration",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // remove field
  collection.fields.removeById("relation2897713717")

  // remove field
  collection.fields.removeById("number650664106")

  // remove field
  collection.fields.removeById("number3801414005")

  // remove field
  collection.fields.removeById("number3635897889")

  // remove field
  collection.fields.removeById("number2254405824")

  return app.save(collection)
})
