# antd-form-demo


## 1、调用Form.create()(MyForm)

* 产生一个新容器组件Form，内置getFieldsValue等属性和方法。
* 复制被包裹组件的静态属性到新组建中。
``` js
function createBaseForm(option = {}, mixins = []) {
  
  return function decorate(WrappedComponent) {
    const Form = createReactClass({
      mixins,
      // 其他内置函数
      render() {
        // ...
      }
    });

    //复制包裹组件的静态属性到Form上
    return argumentContainer(Form, WrappedComponent);
  };
}

```

## 2、新组件Form的render

* 执行声明周期事件，主要是： getInitialState 初始化默认的field，这里默认无
* render函数之间返回被包裹的元素，但是被注入了Form组件的属性

``` js
render() {
    const { wrappedComponentRef, ...restProps } = this.props;
    const formProps = {
        [formPropName]: this.getForm(), //从mixin引入的 在createDOMForm中
    };
    const props = mapProps.call(this, {
        ...formProps,
        ...restProps,
    });
    //把form属性挂在到WrappedComponent属性上
    return <WrappedComponent {...props} />;
}
```

----

接下来进行表单项的绑定。

## 3、使用getFieldDecorator绑定表单项

``` js
{getFieldDecorator('userName', {
    rules: [{ required: true, message: 'Please input your username!' }],
    })(
    <Input prefix={<Icon type="user" style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="Username" />
)}
```

getFieldDecorator需要传递如下参数：
* 字段名
* 字段描述信息，如验证信息rules
* 存储字段相关信息：fieldsStore[字段名]={rules：{},value:{},onChange(){}}
* onChange事件会自动触发验证条件。
* 返回一个高阶函数，需要传递input进行绑定。

``` js

getFieldDecorator(name, fieldOption) {
    //初始化store字段，绑定onChange事件
    const props = this.getFieldProps(name, fieldOption);
    //props: {value: "", ref: ƒ, onChange: ƒ}

    //接收传入input
    return (fieldElem) => {
        const fieldMeta = this.fieldsStore.getFieldMeta(name);
        const originalProps = fieldElem.props;
        fieldMeta.originalProps = originalProps;
        fieldMeta.ref = fieldElem.ref;

        // 克隆传入的input组件，注入
        return React.cloneElement(fieldElem, {
        ...props,
        ...this.fieldsStore.getFieldValuePropValue(fieldMeta),// { value:'123' }
        });
    };
}

```


## 4、传入input组件

* 给组件注入属性，例如：onChange事件等
* 双向绑定完成，更改字段会同时改变fieldsStore[字段名]中的值。

``` js

getFieldProps(name, usersFieldOption = {}) {
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
    
    const inputProps = {
        ...this.fieldsStore.getFieldValuePropValue(fieldOption),
        ref: this.getCacheBind(name, `${name}__ref`, this.saveRef),
    };

    //转换成数组格式
    const validateRules = normalizeValidateRules(validate, rules, validateTrigger);
    //validateRules [{"trigger":["onChange"],"rules":[{"required":true,"message":"What's your name?"}]}]
    const validateTriggers = getValidateTriggers(validateRules);
    validateTriggers.forEach((action) => {
        if (inputProps[action]) return;
        //绑定事件
        inputProps[action] = this.getCacheBind(name, action, this.onCollectValidate);
    });

    //FieldMeta值
    const meta = {
        ...fieldMeta,
        ...fieldOption,
        validate: validateRules,
    };
    // 设置FieldMeta !!!
    this.fieldsStore.setFieldMeta(name, meta);

    return inputProps;
}

onCollectValidate(name_, action, ...args) {
    console.warn('change事件');
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


validateFieldsInternal(fields, {fieldNames,action,options = {},}, callback) {
    const allRules = {};
    const allValues = {};
    const allFields = {};
    const alreadyErrors = {};
    fields.forEach((field) => {
        const name = field.name;
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
        newField.validating = true;
        newField.dirty = true;
        allRules[name] = this.getRules(fieldMeta, action);
        allValues[name] = newField.value;
        allFields[name] = newField;
    });
    this.setFields(allFields);
    // in case normalize
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
    //验证rule，使用第三方库async-validator
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
            nowField.errors = fieldErrors && fieldErrors.errors;
            nowField.value = allValues[name];
            nowField.validating = false;
            nowField.dirty = false;
            nowAllFields[name] = nowField;
        }
        });
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

```

## 设置值setFieldsValue

``` js

setFieldsValue(changedValues, callback) {
    const { fieldsMeta } = this.fieldsStore;
    const values = this.fieldsStore.flattenRegisteredFields(changedValues);
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

    // 设置新值
    this.setFields(newFields, callback);
}


setFields(maybeNestedFields, callback) {
    const fields = this.fieldsStore.flattenRegisteredFields(maybeNestedFields);
    // 更新store中的值
    this.fieldsStore.setFields(fields);
    //react方法，强制更新组件
    this.forceUpdate(callback);
}

```


## 总结

Form内部有一套自己的状态管理：fieldsStore,上面记录着所有表单项的信息，通过getFieldDecorator和表单进行双向绑定。

![image](https://github.com/yhlben/antd-form-demo/blob/master/createform.png?raw=true)
