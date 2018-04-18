import React from 'react';
import AsyncValidator from 'async-validator';
import warning from 'warning';
import get from 'lodash/get';
import set from 'lodash/set';
import createFieldsStore from './createFieldsStore';
import {
  identity,
  normalizeValidateRules,
  getValidateTriggers,
  getValueFromEvent,
  hasRules,
  getParams,
  isEmptyObject,
  flattenArray,
} from './utils';


const DEFAULT_TRIGGER = 'onChange';


export default function createForm(option = {}, mixins = []) {
  const {
    validateMessages,
    onFieldsChange,
    onValuesChange,
    mapProps = identity,
    fieldNameProp, //存放name的字段名
    fieldMetaProp, //默认存放fieldsMeta.fieldsMeta中
    fieldDataProp, //存放getField数据的字段名
    formPropName = 'form',
    // @deprecated
    withRef,
  } = option;

  return function decorate(WrappedComponent) {
    class Form extends React.Component {
      constructor(WrappedComponent) {
        super();
        this.fieldsStore = createFieldsStore({});
        this.instances = {};
        this.cachedBind = {};
        this.clearedFieldMetaCache = {};
        this.getFieldProps=this.getFieldProps.bind(this);
        this.getFieldDecorator=this.getFieldDecorator.bind(this);
        this.validateFields=this.validateFields.bind(this);
        this.setFieldsValue=this.setFieldsValue.bind(this);
      }
      getForm() {
        return {
          getFieldsValue: this.fieldsStore.getFieldsValue,
          getFieldValue: this.fieldsStore.getFieldValue,
          getFieldInstance: this.getFieldInstance,
          setFieldsValue: this.setFieldsValue,
          setFields: this.setFields,
          setFieldsInitialValue: this.fieldsStore.setFieldsInitialValue,
          getFieldDecorator: this.getFieldDecorator,
          getFieldProps: this.getFieldProps,
          getFieldsError: this.fieldsStore.getFieldsError,
          getFieldError: this.fieldsStore.getFieldError,
          isFieldValidating: this.fieldsStore.isFieldValidating,
          isFieldsValidating: this.fieldsStore.isFieldsValidating,
          isFieldsTouched: this.fieldsStore.isFieldsTouched,
          isFieldTouched: this.fieldsStore.isFieldTouched,
          isSubmitting: this.isSubmitting,
          submit: this.submit,
          validateFields: this.validateFields,
          resetFields: this.resetFields,
        };
      }

      onCollectCommon(name, action, args) {
        const fieldMeta = this.fieldsStore.getFieldMeta(name);
        console.log('执行事件。。。。。。');
        if (fieldMeta[action]) {
          fieldMeta[action](...args);
        } else if (fieldMeta.originalProps && fieldMeta.originalProps[action]) {
          // 执行自定义事件
          fieldMeta.originalProps[action](...args);
        }
        // 获取表单中的值，默认value
        const value = fieldMeta.getValueFromEvent ?
          fieldMeta.getValueFromEvent(...args) :
          getValueFromEvent(...args);

        // 自定义onValuesChange事件执行
        if (onValuesChange && value !== this.fieldsStore.getFieldValue(name)) {
          const valuesAll = this.fieldsStore.getAllValues();
          const valuesAllSet = {};
          valuesAll[name] = value;
          Object.keys(valuesAll).forEach(key => set(valuesAllSet, key, valuesAll[key]));
          onValuesChange(this.props, set({}, name, value), valuesAllSet);
        }

        const field = this.fieldsStore.getField(name);
        return ({ name, field: { ...field, value, touched: true }, fieldMeta });
      }

      onCollect(name_, action, ...args) {
        const { name, field, fieldMeta } = this.onCollectCommon(name_, action, args);
        const { validate } = fieldMeta;
        const newField = {
          ...field,
          dirty: hasRules(validate),
        };
        this.setFields({
          [name]: newField,
        });
      }

      onCollectValidate(name_, action, ...args) {
        console.warn('change事件位置');
        const { field, fieldMeta } = this.onCollectCommon(name_, action, args);

        const newField = {
          ...field,
          dirty: true,
        };
        
        // 验证
        this.validateFieldsInternal([newField], {
          action,
          options: {
            firstFields: !!fieldMeta.validateFirst,
          },
        });
      }

      //获取缓存中的事件,避免重复绑定事件
      getCacheBind(name, action, fn) {
        if (!this.cachedBind[name]) {
          this.cachedBind[name] = {};
        }
        const cache = this.cachedBind[name];
        if (!cache[action]) {
          cache[action] = fn.bind(this, name, action);
        }
        return cache[action];
      }

      recoverClearedField(name) {
        if (this.clearedFieldMetaCache[name]) {
          this.fieldsStore.setFields({
            [name]: this.clearedFieldMetaCache[name].field,
          });
          this.fieldsStore.setFieldMeta(name, this.clearedFieldMetaCache[name].meta);
          delete this.clearedFieldMetaCache[name];
        }
      }

      getFieldDecorator(name, fieldOption) {
        // 获取原始字段配置
        const props = this.getFieldProps(name, fieldOption);
        //props: {value: "", ref: ƒ, onChange: ƒ}
        return (fieldElem) => {
          const fieldMeta = this.fieldsStore.getFieldMeta(name);
          //  fieldMeta
          //  {"initialValue":"",
          //  "name":"name2",
          //  "trigger":"onChange",
          //  "valuePropName":"value",
          //  "validate":[{"trigger":["onChange"],"rules":[{"required":true,"message":"What's your name?"}]}],
          //  "rules":[{"required":true,"message":"What's your name?"}]}
          const originalProps = fieldElem.props;
          fieldMeta.originalProps = originalProps;
          fieldMeta.ref = fieldElem.ref;
          return React.cloneElement(fieldElem, {
            ...props,
            ...this.fieldsStore.getFieldValuePropValue(fieldMeta),// { value:'123' }
          });
        };
      }

      getFieldProps(name, usersFieldOption = {}) {
        delete this.clearedFieldMetaCache[name];

        const fieldOption = {
          name,// 自定义组件名称
          trigger: DEFAULT_TRIGGER,//默认绑定 onChange事件
          valuePropName: 'value', //默认值是value属性
          validate: [],
          ...usersFieldOption,
        };

        const {
          rules,
          trigger,
          validateTrigger = trigger,
          validate,
        } = fieldOption;

        const fieldMeta = this.fieldsStore.getFieldMeta(name);
        //第一次进入时，为 {}
        if ('initialValue' in fieldOption) {
          fieldMeta.initialValue = fieldOption.initialValue;
        }

        const inputProps = {
          ...this.fieldsStore.getFieldValuePropValue(fieldOption),
          ref: this.getCacheBind(name, `${name}__ref`, this.saveRef),
        };

        if (fieldNameProp) {
          inputProps[fieldNameProp] = name;
        }

        //转换成数组格式
        const validateRules = normalizeValidateRules(validate, rules, validateTrigger);
        //validateRules [{"trigger":["onChange"],"rules":[{"required":true,"message":"What's your name?"}]}]
        const validateTriggers = getValidateTriggers(validateRules);
        validateTriggers.forEach((action) => {
          if (inputProps[action]) return;
          //绑定事件
          inputProps[action] = this.getCacheBind(name, action, this.onCollectValidate);
        });

        // 默认事件
        if (trigger && validateTriggers.indexOf(trigger) === -1) {
          //绑定事件默认(onchange)
          inputProps[trigger] = this.getCacheBind(name, trigger, this.onCollect);
        }

        //FieldMeta值
        const meta = {
          ...fieldMeta,
          ...fieldOption,
          validate: validateRules,
        };
        // 设置FieldMeta !!!
        this.fieldsStore.setFieldMeta(name, meta);

        if (fieldMetaProp) {
          inputProps[fieldMetaProp] = meta;
        }

        if (fieldDataProp) {
          inputProps[fieldDataProp] = this.fieldsStore.getField(name);
        }

        return inputProps;
      }

      getFieldInstance(name) {
        return this.instances[name];
      }

      getRules(fieldMeta, action) {
        const actionRules = fieldMeta.validate.filter((item) => {
          return !action || item.trigger.indexOf(action) >= 0;
        }).map((item) => item.rules);
        return flattenArray(actionRules);
      }

      // 设置属性值
      setFields(maybeNestedFields, callback) {
        console.log('开始设置值');
        const fields = this.fieldsStore.flattenRegisteredFields(maybeNestedFields);
        // 更新store中的值
        this.fieldsStore.setFields(fields);

        // 执行自定义事件
        if (onFieldsChange) {
          const changedFields = Object.keys(fields)
            .reduce((acc, name) => set(acc, name, this.fieldsStore.getField(name)), {});
          onFieldsChange(this.props, changedFields, this.fieldsStore.getNestedAllFields());
        }

        //react方法，强制更新组件
         this.forceUpdate(callback);
      }

      resetFields(ns) {
        const newFields = this.fieldsStore.resetFields(ns);
        if (Object.keys(newFields).length > 0) {
          this.setFields(newFields);
        }
        if (ns) {
          const names = Array.isArray(ns) ? ns : [ns];
          names.forEach(name => delete this.clearedFieldMetaCache[name]);
        } else {
          this.clearedFieldMetaCache = {};
        }
      }

      setFieldsValue(changedValues, callback) {
        console.log('changedValues',changedValues);
        const { fieldsMeta } = this.fieldsStore;
        const values = this.fieldsStore.flattenRegisteredFields(changedValues);
        console.log('转换后的',values);
        const newFields = Object.keys(values).reduce((acc, name) => {
          const isRegistered = fieldsMeta[name];
          
          if (isRegistered) {
            const value = values[name];
            acc[name] = {
              value,
            };
          }
          return acc;
        }, {});
        this.setFields(newFields, callback);

        // 有自定义事件
        if (onValuesChange) {
          const allValues = this.fieldsStore.getAllValues();
          onValuesChange(this.props, changedValues, allValues);
        }
      }

      //保存ref信息
      saveRef(name, _, component) {
        if (!component) {
          // after destroy, delete data
          this.clearedFieldMetaCache[name] = {
            field: this.fieldsStore.getField(name),
            meta: this.fieldsStore.getFieldMeta(name),
          };
          this.fieldsStore.clearField(name);
          delete this.instances[name];
          delete this.cachedBind[name];
          return;
        }
        this.recoverClearedField(name);
        const fieldMeta = this.fieldsStore.getFieldMeta(name);
        if (fieldMeta) {
          const ref = fieldMeta.ref;
          if (ref) {
            if (typeof ref === 'string') {
              throw new Error(`can not set ref string for ${name}`);
            }
            ref(component);
          }
        }
        this.instances[name] = component;
      }

      validateFieldsInternal(fields, {
        fieldNames,
        action,
        options = {},
      }, callback) {
        const allRules = {};
        const allValues = {};
        const allFields = {};
        const alreadyErrors = {};
        console.log('把新值传到这里来');
        fields.forEach((field) => {
          const name = field.name;

          // 不需要验证逻辑
          if (options.force !== true && field.dirty === false) {
            if (field.errors) {
              set(alreadyErrors, name, { errors: field.errors });
            }
            return;
          }

          const fieldMeta = this.fieldsStore.getFieldMeta(name);
          const newField = {
            ...field,
          };
          newField.errors = undefined;
          newField.validating = true; // 正在验证状态
          newField.dirty = true; // 表示需要验证
          allRules[name] = this.getRules(fieldMeta, action);
          allValues[name] = newField.value;
          allFields[name] = newField;
        });
        console.log('设置field',JSON.stringify(allFields));
        // {"name2":{"name":"name2","value":"","touched":true,"dirty":true,"validating":true}}
        this.setFields(allFields);

        Object.keys(allValues).forEach((f) => {
          allValues[f] = this.fieldsStore.getFieldValue(f);
        });
        if (callback && isEmptyObject(allFields)) {
          callback(isEmptyObject(alreadyErrors) ? null : alreadyErrors,
            this.fieldsStore.getFieldsValue(fieldNames));
          return;
        }
        // 初始化验证，使用async-validator库
        const validator = new AsyncValidator(allRules);
        if (validateMessages) {
          validator.messages(validateMessages);
        }
        //验证rule
        validator.validate(allValues, options, (errors) => {
          const errorsGroup = {
            ...alreadyErrors,
          };
          if (errors && errors.length) {
            errors.forEach((e) => {
              const fieldName = e.field;
              const field = get(errorsGroup, fieldName);
              if (typeof field !== 'object' || Array.isArray(field)) {
                set(errorsGroup, fieldName, { errors: [] });
              }
              const fieldErrors = get(errorsGroup, fieldName.concat('.errors'));
              fieldErrors.push(e);
            });
          }
          const expired = [];
          const nowAllFields = {};
          Object.keys(allRules).forEach((name) => {
            const fieldErrors = get(errorsGroup, name);
            const nowField = this.fieldsStore.getField(name);
            // avoid concurrency problems
            if (nowField.value !== allValues[name]) {
              expired.push({
                name,
              });
            } else {
              // 验证完成
              nowField.errors = fieldErrors && fieldErrors.errors;
              nowField.value = allValues[name];
              nowField.validating = false;
              nowField.dirty = false;
              nowAllFields[name] = nowField;
            }
          });
          console.log('again设置field',JSON.stringify(nowAllFields));
          // {"name2":{"name":"name2","value":"","touched":true,"dirty":false,"errors":[{"message":"What's your name?","field":"name2"}],"validating":false}}
          this.setFields(nowAllFields);
          if (callback) {
            if (expired.length) {
              expired.forEach(({ name }) => {
                const fieldErrors = [{
                  message: `${name} need to revalidate`,
                  field: name,
                }];
                set(errorsGroup, name, {
                  expired: true,
                  errors: fieldErrors,
                });
              });
            }

            callback(isEmptyObject(errorsGroup) ? null : errorsGroup,
              this.fieldsStore.getFieldsValue(fieldNames));
          }
        });
      }

      validateFields(ns, opt, cb) {
        const { names, callback, options } = getParams(ns, opt, cb);
        const fieldNames = names ?
          this.fieldsStore.getValidFieldsFullName(names) :
          this.fieldsStore.getValidFieldsName();
          console.log('这里开始验证。');
        const fields = fieldNames
          .filter(name => {
            const fieldMeta = this.fieldsStore.getFieldMeta(name);
            return hasRules(fieldMeta.validate);
          }).map((name) => {
            const field = this.fieldsStore.getField(name);
            field.value = this.fieldsStore.getFieldValue(name);
            return field;
          });
        if (!fields.length) {
          if (callback) {
            callback(null, this.fieldsStore.getFieldsValue(fieldNames));
          }
          return;
        }
        if (!('firstFields' in options)) {
          options.firstFields = fieldNames.filter((name) => {
            const fieldMeta = this.fieldsStore.getFieldMeta(name);
            return !!fieldMeta.validateFirst;
          });
        }
        this.validateFieldsInternal(fields, {
          fieldNames,
          options,
        }, callback);
      }

      isSubmitting() {
        return this.state.submitting;
      }

      submit(callback) {
        const fn = () => {
          this.setState({
            submitting: false,
          });
        };
        this.setState({
          submitting: true,
        });
        callback(fn);
      }
      
      render() {
        var props = { form: this.getForm() };
        return (
          <WrappedComponent {...props} />
        );
      }
    }
    //省略静态方法拷贝
    return Form;
  }
}
