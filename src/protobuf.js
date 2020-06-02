const minimatch = require('minimatch')
const {CodeGeneratorRequest} = require('google-protobuf/google/protobuf/compiler/plugin_pb')
const {
	FileDescriptorProto,
	DescriptorProto,
	EnumDescriptorProto,
	EnumValueDescriptorProto,
	FieldDescriptorProto,
	OneofDescriptorProto,
	ServiceDescriptorProto,
	MethodDescriptorProto,
	FileOptions,
	MessageOptions,
	FieldOptions,
	OneofOptions,
	EnumOptions,
	EnumValueOptions,
	ServiceOptions,
	MethodOptions,
	ExtensionRangeOptions,
} = require('google-protobuf/google/protobuf/descriptor_pb')
const mem = require('mem')

const mapFile = (context, options, callback) => {
	switch (Object.getPrototypeOf(context).constructor) {
		case CodeGeneratorRequest:
			return context.getProtoFileList().filter(
				fileDesc => context.getFileToGenerateList().find(
					fileName => fileDesc.getName() === fileName
				)
			).map(callback)
		case FileDescriptorProto:
			return [context].map(callback)
		default:
			return []
	}
}
module.exports.mapFile = mapFile

const mapDependency = (context, options, callback) => {
	return mapFile(context, options, fileDesc => {
		return fileDesc.getDependencyList().map(callback)
	}).flat(Infinity)
}
module.exports.mapDependency = mapDependency

const mapPackage = (context, options, callback) => {
	const packageList = {}
	return mapFile(context, options, fileDesc => {
		const package = fileDesc.getPackage()
		if (!packageList[package]) {
			packageList[package] = options.data.root.clone()
			packageList[package].setProtoFileList([fileDesc])
			packageList[package].setFileToGenerateList([fileDesc.getName()])
			return packageList[package]
		}
		packageList[package].addFileToGenerate(fileDesc.getName())
		packageList[package].addProtoFile(fileDesc)
	}).filter(_ => _).map(callback)
}
module.exports.mapPackage = mapPackage

const mapMessage = (context, options, callback) => {
	switch (Object.getPrototypeOf(context).constructor) {
		// TODO: get message from field type
		// case FieldDescriptorProto:
		//	return mapType(context, options, type => {
		//		if (type === 'message') {
		//			return [].map(callback)
		//		}
		//	}).flat(Infinity).filter(_ => _)
		case DescriptorProto:
			return [context].map(callback)
		case FileDescriptorProto:
			return context.getMessageTypeList().map(callback)
		default:
			return mapFile(context, options, fileDesc => {
				return mapMessage(fileDesc, options, applyAsParentContext(context, fileDesc, options, callback))
			}).flat(Infinity)
	}
}
module.exports.mapMessage = mapMessage

const mapNested = (context, options, callback) => {
	switch (Object.getPrototypeOf(context).constructor) {
			case DescriptorProto:
				return context.getNestedTypeList().map(callback)
			default:
				return []
	}
}
module.exports.mapNested = mapNested

const mapEnum = (context, options, callback) => {
	switch (Object.getPrototypeOf(context).constructor) {
		case EnumDescriptorProto:
			return [context].map(callback)
		case DescriptorProto:
			return context.getEnumTypeList().map(callback)
		case FileDescriptorProto:
			return context.getEnumTypeList().map(callback)
		default:
			return mapFile(context, options, fileDesc => {
				return mapEnum(fileDesc, options, applyAsParentContext(context, fileDesc, options, callback))
			}).flat(Infinity)
	}
}
module.exports.mapEnum = mapEnum

const mapValue = (context, options, callback) => {
	switch (Object.getPrototypeOf(context).constructor) {
		case EnumValueDescriptorProto:
			return [context].map(callback)
		case EnumDescriptorProto:
			return context.getValueList().map(callback)
		default:
			return mapFile(context, options, fileDesc => {
				return mapValue(fileDesc, options, applyAsParentContext(context, fileDesc, options, callback))
			}).flat(Infinity)
	}
}

const mapOneOf = (context, options, callback) => {
	switch (Object.getPrototypeOf(context).constructor) {
		case OneofDescriptorProto:
			return [context].map(callback)
		case DescriptorProto:
			return context.getOneofDeclList().map(callback)
		default:
			return mapFile(context, options, fileDesc => {
				return mapOneOf(fileDesc, options, applyAsParentContext(context, fileDesc, options, callback))
			})
	}
}
module.exports.mapOneOf = mapOneOf

const mapOption = (context, options, callback) => {
	if (!context) {
		return []
	}
	switch (Object.getPrototypeOf(context).constructor) {
		case FileOptions:
		case MessageOptions:
		case FieldOptions:
		case OneofOptions:
		case EnumOptions:
		case EnumValueOptions:
		case ServiceOptions:
		case MethodOptions:
		case ExtensionRangeOptions:
			return [context].map(callback)
		case FileDescriptorProto:
		case DescriptorProto:
		case FieldDescriptorProto:
		case EnumValueDescriptorProto:
		case OneofDescriptorProto:
		case ServiceDescriptorProto:
		case MethodDescriptorProto:
			return mapOption(context.getOptions(), options, callback)
		default:
			return mapFile(context, options, fileDesc => {
				return mapOption(fileDesc, options, callback)
			}).flat(Infinity)
	}
}
module.exports.mapOption = mapOption

const mapLabel = (context, options, callback) => {
	switch (Object.getPrototypeOf(context).constructor) {
		case FieldDescriptorProto:
			switch (context.getLabel()) {
				case FieldDescriptorProto.Label.LABEL_OPTIONAL:
					return 'optional'
				case FieldDescriptorProto.Label.LABEL_REQUIRED:
					return 'required'
				case FieldDescriptorProto.Label.LABEL_REPEATED:
					return 'repeated'
				default:
					return ''
			}
		case DescriptorProto:
			return mapField(context, options, fieldDesc => {
				return mapLabel(fieldDesc, options, applyAsParentContext(context, null, options, callback))
			}).flat(Infinity)
		default:
			return mapFile(context, options, fileDesc => {
				return mapMessage(context, options, messageDesc => {
					return mapLabel(messageDesc, options, applyAsParentContext(context, fileDesc, options, callback))
				}).flat(Infinity)
			}).flat(Infinity)
	}
}
module.exports.mapLabel = mapLabel

const mapType = (context, options, callback) => {
	switch (Object.getPrototypeOf(context).constructor) {
		case FieldDescriptorProto:
			switch (context.getType()) {
				case FieldDescriptorProto.Type.TYPE_DOUBLE:
					return 'double'
				case FieldDescriptorProto.Type.TYPE_FLOAT:
					return 'float'
				case FieldDescriptorProto.Type.TYPE_INT64:
					return 'int64'
				case FieldDescriptorProto.Type.TYPE_UINT64:
					return 'uint64'
				case FieldDescriptorProto.Type.TYPE_INT32:
					return 'int32'
				case FieldDescriptorProto.Type.TYPE_FIXED64:
					return 'fixed64'
				case FieldDescriptorProto.Type.TYPE_FIXED32:
					return 'fixed32'
				case FieldDescriptorProto.Type.TYPE_BOOL:
					return 'bool'
				case FieldDescriptorProto.Type.TYPE_STRING:
					return 'string'
				case FieldDescriptorProto.Type.TYPE_GROUP:
					return 'group'
				case FieldDescriptorProto.Type.TYPE_MESSAGE:
					return 'message'
				case FieldDescriptorProto.Type.TYPE_BYTES:
					return 'bytes'
				case FieldDescriptorProto.Type.TYPE_UINT32:
					return 'uint32'
				case FieldDescriptorProto.Type.TYPE_ENUM:
					return 'enum'
				case FieldDescriptorProto.Type.TYPE_SFIXED32:
					return 'sfixed32'
				case FieldDescriptorProto.Type.TYPE_SFIXED64:
					return 'sfixed64'
				case FieldDescriptorProto.Type.TYPE_SINT32:
					return 'sint32'
				case FieldDescriptorProto.Type.TYPE_SINT64:
					return 'sint64'
				default:
					return ''
			}
		case DescriptorProto:
			return mapField(context, options, fieldDesc => {
				return mapType(fieldDesc, options, applyAsParentContext(context, null, options, callback))
			}).flat(Infinity)
		default:
			return mapFile(context, options, fileDesc => {
				return mapMessage(context, options, messageDesc => {
					return mapType(messageDesc, options, applyAsParentContext(context, fileDesc, options, callback))
				})
			}).flat(Infinity)
	}
}
module.exports.mapType = mapType

const mapField = (context, options, callback) => {
	switch (Object.getPrototypeOf(context).constructor) {
		case FieldDescriptorProto:
			return [context].map(callback)
		case DescriptorProto:
			return context.getFieldList().map(callback)
		case FileDescriptorProto:
			return context.getMessageTypeList().map(message => {
				return mapField(message, options, applyAsParentContext(message, context, options, callback))
			}).flat(Infinity)
		default:
			return mapFile(context, options, fileDesc => {
				return mapField(fileDesc, options, applyAsParentContext(context, fileDesc, options, callback))
			}).flat(Infinity)
	}
}
module.exports.mapField = mapField

const mapExtension = (context, options, callback) => {
	switch (Object.getPrototypeOf(context).constructor) {
		case FieldDescriptorProto:
			return [context].map(callback)
		case DescriptorProto:
			return context.getExtensionList().map(callback)
		case FileDescriptorProto:
			return context.getMessageTypeList().map(message => {
				return mapExtension(message, options, applyAsParentContext(message, context, options, callback))
			}).flat(Infinity)
		default:
			return mapFile(context, options, fileDesc => {
				return mapExtension(fileDesc, options, applyAsParentContext(context, fileDesc, options, callback))
			}).flat(Infinity)
	}
}
module.exports.mapExtension = mapExtension

const mapService = (context, options, callback) => {
	switch (Object.getPrototypeOf(context).constructor) {
		case ServiceDescriptorProto:
			return [context].map(callback)
		case FileDescriptorProto:
			return context.getServiceList().map(callback)
		default:
			return mapFile(context, options, fileDesc => {
				return mapService(fileDesc, options, applyAsParentContext(context, fileDesc, options, callback))
			}).flat(Infinity)
	}
}
module.exports.mapService = mapService

const mapRPC = (context, options, callback) => {
	switch (Object.getPrototypeOf(context).constructor) {
		case MethodDescriptorProto:
			return [context].map(callback)
		case ServiceDescriptorProto:
			return context.getMethodList().map(callback)
		case FileDescriptorProto:
			return context.getServiceList().map(service => {
				return mapRPC(service, options, applyAsParentContext(service, context, options, callback))
			}).flat(Infinity)
		default:
			return mapFile(context, options, fileDesc => {
				return mapRPC(fileDesc, options, callback)
			}).flat(Infinity)
	}
}
module.exports.mapRPC = mapRPC

const applyAsParentContext = (context, fileDesc, options, callback) => (value, index, array, key) => {
	switch (Object.getPrototypeOf(context).constructor) {
		case CodeGeneratorRequest:
			if (context !== options.data.root) {
				// context === package
				return callback(value, index, array, key)
			} else {
				// context === root
				return applyAsParentContext(
					fileDesc,
					fileDesc,
					options,
					callback
				)(value, index, array, key)
			}
		default:
			const prefix = context.getPackage
				? context.getPackage()
				: context.getName()
			if (typeof value === 'object') {
				const clone = value.clone()
				clone.setName(prefix + '.' + value.getName())
				return callback(clone, index, array, key)
			}
			if (typeof value === 'string') {
				return callback(prefix + '.' + value, index, array, key)
			}
			return callback(value, index, array, key)
	}
}
module.exports.applyAsParentContext = applyAsParentContext

const applyOptionsIteratorData = (options, callback) => (value, index, array, key) => {
	let data = {
		...options.data,
		key,
		index,
		first: index === 0,
		last: index === array.length - 1,
		...(value.getOptions && value.getOptions() ? value.getOptions().toObject() : {}),
	}
	switch (Object.getPrototypeOf(value).constructor) {
		case CodeGeneratorRequest:
			if (value !== options.data.root) {
				// package
				data.package = {
					name: value.getProtoFileList()[0].getPackage()
				}
				data = { ...data, ...data.package }
			}
			break
		case FileDescriptorProto:
			data.file = {
				name: value.getName().replace(/.proto$/, ''),
			}
			data = { ...data, ...data.file }
			break
		case DescriptorProto:
			data.message = {
				name: value.getName(),
				recursive: () => {
					const recursiveOptions = { ...options, _parent: data, data: {} }
					return mapNested(
						value,
						recursiveOptions,
						applyOptions(options)
					).join('\n')
				},
			}
			data = { ...data, ...data.message }
			break
		case EnumDescriptorProto:
			data.enum = {
				name: value.getName(),
			}
			data = { ...data, ...data.enum }
			break
		case EnumValueDescriptorProto:
			data.value = {
				name: value.getName(),
				number: value.getNumber(),
			}
			data = { ...data, ...data.value }
			break
		case FieldDescriptorProto:
			data.field = {
				name: value.getName(),
				type: mapType(value, _ => _),
				label: mapLabel(value, _ => _),
				number: value.getNumber(),
			}
			data = { ...data, ...data.field }
			break
		case OneofDescriptorProto:
			data.oneof = {
				name: value.getName(),
			}
			data = { ...data, ...data.oneof }
			break
		case ServiceDescriptorProto:
			data.service = {
				name: value.getName(),
			}
			data = { ...data, ...data.service }
			break
		case MethodDescriptorProto:
			data.rpc = {
				name: value.getName(),
				input: value.getInputType().replace(/^\./, ''),
				output: value.getOutputType().replace(/^\./, ''),
				client: value.getClientStreaming() ? 'stream' : 'unary',
				server: value.getServerStreaming() ? 'stream' : 'unary',
			}
			data = { ...data, ...data.rpc }
			break
		case FileOptions:
		case MessageOptions:
		case FieldOptions:
		case OneofOptions:
		case EnumOptions:
		case EnumValueOptions:
		case ServiceOptions:
		case MethodOptions:
		case ExtensionRangeOptions:
			data.option = value.toObject()
			data = { ...data, ...data.option }
			break
		default:
			break
	}
	return callback(value, { data })
}
module.exports.applyOptionsIteratorData = applyOptionsIteratorData

const matchOptionsHash = (options, trueMatch, falseMatch) => (value, { data }) => {
	if (Object.entries(options.hash).every(([key, value]) => {
		switch (typeof value) {
			case 'string':
				return minimatch(data[key], value)
			default:
				return data[key] === value
		}
	})) {
		return trueMatch(value, { data })
	} else if (falseMatch) {
		return falseMatch(value, { data })
	} else {
		return ''
	}
}
module.exports.matchOptionsHash = matchOptionsHash

const applyOptions = (options) => {
	return options.fn
		? applyOptionsIteratorData(options, matchOptionsHash(options, options.fn, options.inverse))
		: applyOptionsIteratorData(options, matchOptionsHash(options, (_, { data }) => data.name))
}

module.exports.register = handlebars => {
	handlebars.registerHelper('import', function (options) {
		return mapDependency(this, options, applyOptions(options)).join('\n')
	})
	handlebars.registerHelper('file', function (options) {
		return mapFile(this, options, applyOptions(options)).join('\n')
	})
	handlebars.registerHelper('package', function (options) {
		return mapPackage(this, options, applyOptions(options)).join('\n')
	})
	handlebars.registerHelper('enum', function (options) {
		return mapEnum(this, options, applyOptions(options)).join('\n')
	})
	handlebars.registerHelper('value', function (options) {
		return mapValue(this, options, applyOptions(options)).join('\n')
	})
	handlebars.registerHelper('message', function (options) {
		return mapMessage(this, options, applyOptions(options)).join('\n')
	})
	handlebars.registerHelper('field', function (options) {
		return mapField(this, options, applyOptions(options)).join('\n')
	})
	handlebars.registerHelper('oneof', function (options) {
		return mapOneOf(this, options, applyOptions(options)).join('\n')
	})
	handlebars.registerHelper('option', function (options) {
		return mapOption(this, options, applyOptions(options)).join('\n')
	})
	handlebars.registerHelper('service', function (options) {
		return mapService(this, options, applyOptions(options)).join('\n')
	})
	handlebars.registerHelper('rpc', function (options) {
		return mapRPC(this, options, applyOptions(options)).join('\n')
	})
	handlebars.registerHelper('extension', function (options) {
		return mapExtension(this, options, applyOptions(options)).join('\n')
	})
}

